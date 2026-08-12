#!/usr/bin/env node
/**
 * visual-diff — advisory drift check of migrated blocks vs. the source baseline
 * (docs/broadridge-EDS-RULES.md §8). Renders each block against fixture content
 * in headless Chromium (loading the block's REAL css + decorate js + global
 * styles/styles.css), extracts computed styles, and diffs against
 * tools/quality/source-baseline.json. Deviations listed in
 * tools/quality/visual-diff-allowlist.json are suppressed.
 *
 * ADVISORY ONLY: always exits 0. It prints drift so it is seen after every
 * block/CSS edit; it never blocks. Wired as a PostToolUse Edit|Write hook and
 * available as `npm run broadridge:check:visual`.
 *
 * Requires dev deps: playwright (+ chromium). If missing, prints a hint and
 * exits 0 (never breaks the edit flow).
 *
 * Scope: reads changed paths from $CLAUDE_TOOL_PATHS / argv if provided, else
 * checks every block present in the baseline. Only blocks that both (a) appear
 * in source-baseline.json and (b) exist under blocks/ are rendered.
 */
import {
  readFileSync, existsSync, mkdirSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { numOf, classify } from './lib/style-audit-utils.mjs';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'tools/quality/source-baseline.json');
const ALLOWLIST = join(ROOT, 'tools/quality/visual-diff-allowlist.json');
const OUT_DIR = join(ROOT, 'tools/quality/visual-output');
const REPORT_FILE = join(OUT_DIR, 'style-drift.md');

// tolerances
const PX_TOL = 2; // px difference tolerated on sizes
const OK = '✓';
const WARN = '⚠';

function loadJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log(`${WARN} visual-diff: playwright not installed — skipping (advisory). Run: npm i -D playwright && npx playwright install chromium`);
  process.exit(0);
}

const baseline = loadJson(BASELINE, null);
if (!baseline) {
  console.log(`${WARN} visual-diff: no source-baseline.json — skipping (advisory).`);
  process.exit(0);
}
const allowlist = loadJson(ALLOWLIST, { allow: [] });

// Is a block+property deviation intentional (allowlisted)?
function isAllowed(block, propPath) {
  return (allowlist.allow || []).some((a) => {
    const blockMatch = a.block === '*' || a.block === block;
    const propMatch = a.property === '*'
      || a.property === propPath
      || (a.property.endsWith('.*') && propPath.startsWith(a.property.slice(0, -2)))
      || (a.property === `${block.split('.')[0]}` )
      || propPath.endsWith(a.property);
    return blockMatch && propMatch;
  });
}

// Compare one value; return null if within tolerance, else a drift descriptor.
function diffValue(prop, expected, actual) {
  if (expected == null || actual == null) return null;
  if (String(expected) === String(actual)) return null;
  // px tolerance for size-ish props
  if (/size|height|spacing|radius|width/i.test(prop)) {
    const e = numOf(expected); const a = numOf(actual);
    if (e != null && a != null && Math.abs(e - a) <= PX_TOL) return null;
  }
  return { prop, expected: String(expected), actual: String(actual) };
}

// Fixture markup per block (mirrors the authored content shape each decorate
// expects). Measurement probes are defined inline in page.evaluate below.
const FIXTURES = {
  'hero-banner': '<div class="hero-banner"><div><div><picture><img src="https://www.broadridge.com/cit/_assets/images/2020/02/img_herobg_cit.jpg" alt="hero"></picture></div></div><div><div><h1>Collective Investment Trusts</h1><p>A cost-effective approach to diversified investment portfolios</p></div></div></div>',
  cards: '<div class="cards feature"><div><div><h3><a href="/cit/cit-services">CIT Services</a></h3><p>We offer a range of services.</p></div></div><div><div><h3><a href="/cit/matrix-cits">Matrix CITs</a></h3><p>Explore our full range of CITs.</p></div></div></div>',
  columns: '<div class="columns compare"><div><div><h3>CITs are:</h3><ul><li>Bank/trust maintained pooled funds</li><li>Valued daily</li></ul></div><div><h3>CITs are not:</h3><ul><li>Mutual funds under the 1940 Act</li><li>Exchange traded</li></ul></div></div></div>',
  'form-contact': '<div class="form-contact"><div><div>Heading</div><div>Talk to us</div></div><div><div>Submit</div><div>Contact Sales</div></div></div>',
};

const blocksInBaseline = Object.keys(baseline).filter((k) => !k.startsWith('_') && k !== 'global' && k !== 'sections' && FIXTURES[k]);

// Determine changed scope (advisory: if we can't tell, check all baseline blocks).
const changed = (process.env.CLAUDE_TOOL_PATHS || process.argv.slice(2).join('\n') || '')
  .split(/\s+/).filter(Boolean);
let targets = blocksInBaseline;
if (changed.length) {
  const touched = new Set();
  for (const p of changed) {
    const m = p.match(/blocks\/([a-z0-9-]+)\//);
    if (m && FIXTURES[m[1]]) touched.add(m[1]);
    if (/styles\/(styles|fonts)\.css/.test(p)) blocksInBaseline.forEach((b) => touched.add(b)); // global change -> all
  }
  if (touched.size) targets = [...touched];
}

if (!targets.length) {
  console.log(`${OK} visual-diff: no baseline-tracked blocks in this change — nothing to compare.`);
  process.exit(0);
}

const globalCss = existsSync(join(ROOT, 'styles/styles.css')) ? readFileSync(join(ROOT, 'styles/styles.css'), 'utf8') : '';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let totalDrift = 0;
const report = [];
const styleDriftTables = [];

for (const block of targets) {
  const cssPath = join(ROOT, `blocks/${block}/${block}.css`);
  const jsPath = join(ROOT, `blocks/${block}/${block}.js`);
  const blockCss = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const hasJs = existsSync(jsPath);
  const fixture = FIXTURES[block];

  const html = `<!DOCTYPE html><html><head><style>${globalCss}\n${blockCss}</style></head>`
    + `<body><main><div class="section ${block}-container">${fixture}</div></main></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });

  // run the block's decorate() (module) if present
  if (hasJs) {
    try {
      const src = readFileSync(jsPath, 'utf8')
        .replace(/import\s+[^;]+;/g, '') // strip imports (aem.js helpers unavailable in-page)
        .replace(/export default (async )?function\s*\w*/, 'window.__decorate = $1function');
      await page.addScriptTag({ content: `${src}\n;(async()=>{try{const el=document.querySelector('.${block}');if(window.__decorate)await window.__decorate(el);}catch(e){window.__decErr=String(e);}})();` });
      await page.waitForTimeout(150);
    } catch { /* decorate best-effort; styling still measurable */ }
  }

  // Extract computed styles via probes defined inline for portability.
  const measured = await page.evaluate((blk) => {
    const g = (el, p) => (el ? getComputedStyle(el)[p] : null);
    const fam = (v) => (v || '').split(',')[0].replace(/["']/g, '').trim();
    const root = document.querySelector(`.${blk.split(' ')[0]}`);
    if (!root) return { __noRoot: true };
    const out = {};
    if (blk === 'hero-banner') {
      const h1 = root.querySelector('h1');
      if (h1) Object.assign(out, { 'h1.fontSize': g(h1, 'fontSize'), 'h1.fontWeight': g(h1, 'fontWeight'), 'h1.color': g(h1, 'color'), 'h1.letterSpacing': g(h1, 'letterSpacing'), 'h1.fontFamily': fam(g(h1, 'fontFamily')) });
    } else if (blk === 'cards') {
      const li = root.querySelector('li');
      const title = root.querySelector('h3');
      if (li) out.tileBg = g(li, 'backgroundColor');
      if (title) Object.assign(out, { 'title.fontSize': g(title, 'fontSize'), 'title.fontWeight': g(title, 'fontWeight'), 'title.color': g(title, 'color'), 'title.fontFamily': fam(g(title, 'fontFamily')) });
    } else if (blk === 'columns') {
      const h = root.querySelector('h3');
      if (h) Object.assign(out, { 'compareHeading.fontSize': g(h, 'fontSize'), 'compareHeading.fontWeight': g(h, 'fontWeight'), 'compareHeading.color': g(h, 'color') });
    } else if (blk === 'form-contact') {
      const btn = root.querySelector('.form-contact-submit');
      if (btn) Object.assign(out, { 'submitBtn.backgroundColor': g(btn, 'backgroundColor'), 'submitBtn.borderRadius': g(btn, 'borderRadius'), 'submitBtn.color': g(btn, 'color'), 'submitBtn.fontWeight': g(btn, 'fontWeight') });
    }
    return out;
  }, block);

  if (measured.__noRoot) { report.push(`  ${WARN} ${block}: block did not render (no root element) — check fixture/decorate`); continue; }

  // Flatten the baseline block into the same dot-path keys.
  const base = baseline[block] || {};
  const flat = {};
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'variant' || k.endsWith('Note') || k === 'selectorNote') continue;
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') walk(v, path);
      else flat[path] = v;
    }
  };
  walk(base, '');

  // Every property whose value differs from baseline (beyond tolerance) gets a row — allowlisted
  // deviations are shown too (marked accepted), not hidden, so the table stays a complete picture.
  const diffRows = [];
  for (const [prop, actual] of Object.entries(measured)) {
    const expected = flat[prop];
    if (expected === undefined) continue;
    const d = diffValue(prop, expected, actual);
    if (!d) continue;
    const allowed = isAllowed(block, prop);
    diffRows.push({
      ...d,
      allowed,
      ...(allowed ? { icon: '✅', label: 'allowlisted' } : classify(prop, expected, actual)),
    });
  }

  if (diffRows.length) {
    const unexplained = diffRows.filter((r) => !r.allowed);
    totalDrift += unexplained.length;
    report.push(`  ${unexplained.length ? WARN : OK} ${block}: ${diffRows.length} difference(s) vs source baseline (${unexplained.length} unexplained)`);
    styleDriftTables.push({ block, rows: diffRows });
  } else {
    report.push(`  ${OK} ${block}: matches baseline (within tolerance)`);
  }
}

await browser.close();

console.log(`\nvisual-diff (advisory) — ${targets.length} block(s) checked vs source baseline:`);
report.forEach((r) => console.log(r));

// Build the Property | Source | Migrated | Severity table(s) — printed and written to
// tools/quality/visual-output/style-drift.md so it can be pasted into a PR the same way summary.md
// (the pixel-diff report) is. Legend: 🔴 clear divergence  🟡 minor  🟢 negligible  ✅ allowlisted.
let md = '';
if (styleDriftTables.length) {
  md += '# Styling drift — meaningful differences\n\n';
  md += 'Legend: 🔴 clear divergence · 🟡 minor · 🟢 negligible · ✅ allowlisted (accepted)\n\n';
  for (const { block, rows } of styleDriftTables) {
    md += `## ${block}\n\n`;
    md += '| Property | Source | Migrated | Severity |\n|---|---|---|---|\n';
    for (const r of rows) {
      md += `| ${r.prop} | ${r.expected} | ${r.actual} | ${r.icon} ${r.label} |\n`;
    }
    md += '\n';
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(REPORT_FILE, md);
  console.log(`\n${md}`);
  console.log(`Full table written to ${REPORT_FILE}`);
}

if (totalDrift) {
  console.log(`\n${WARN} ${totalDrift} unexplained (non-allowlisted) difference(s). If intentional, add to tools/quality/visual-diff-allowlist.json; else fix the block CSS. See docs/broadridge-EDS-RULES.md §8.\n`);
} else {
  console.log(`\n${OK} visual-diff: no unexplained drift.\n`);
}
process.exit(0); // advisory — never block
