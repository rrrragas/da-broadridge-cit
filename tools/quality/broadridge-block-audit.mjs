#!/usr/bin/env node
/**
 * broadridge-block-audit — live, multi-viewport QA sweep of migrated blocks vs. the legacy site.
 *
 * Unlike broadridge-visual-diff.mjs (a fast advisory hook that renders one block against a fixture
 * and a static baseline JSON, at one viewport), this script loads the REAL legacy page and the REAL
 * migrated page in a browser, at mobile/tablet/desktop, and reads actual computed styles from both
 * — so it can't go stale the way a hand-captured baseline can (see hero-banner subhead: only
 * visible on legacy at 2 of 3 viewports — a fixture render could never show that). It also computes
 * WCAG contrast ratios and hover-state changes, and reports which DOM element each measurement
 * actually came from (a selector that silently matches the wrong node was the biggest source of
 * bad data during manual investigation of this page).
 *
 * On-demand only (NOT a hook) — it hits an external site and loads 6 real pages per run, too slow
 * to fire on every edit. Run explicitly: `npm run broadridge:audit:blocks`.
 *
 * Usage:
 *   node tools/quality/broadridge-block-audit.mjs [options]
 * Options:
 *   --path <p>       page path (default /cit)
 *   --base <url>     legacy/source origin (default config.parityBase)
 *   --candidate <url> EDS/candidate origin (default config.localCandidate)
 *   --block <list>   comma-separated block names to audit (default: all specced blocks)
 *   --viewport <list> comma-separated viewport names (default: mobile,tablet,desktop)
 *   --out <file>     markdown report path (default tools/quality/visual-output/block-audit.md)
 *
 * Requires dev deps: playwright. Run browsers once: npx playwright install chromium
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { classify, contrastRatio, wcagAAThreshold } from './lib/style-audit-utils.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('broadridge:audit:blocks needs playwright. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ROOT = process.cwd();
let config = {};
try { config = JSON.parse(readFileSync(join(ROOT, 'tools/quality/broadridge-visual.config.json'), 'utf8')); } catch { /* optional */ }

const path_ = arg('path', '/cit');
const base = (arg('base', config.parityBase) || '').replace(/\/+$/, '');
const candidate = (arg('candidate', config.localCandidate) || '').replace(/\/+$/, '');
const outDir = join(ROOT, 'tools/quality/visual-output');
const outFile = arg('out', join(outDir, 'block-audit.md'));

if (!base || !candidate) {
  console.error('No base/candidate URL — set parityBase/localCandidate in broadridge-visual.config.json or pass --base/--candidate.');
  process.exit(1);
}

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
};

// ---- Block specs: each knows how to find its own elements on the legacy page and the migrated
// page (the two DOMs are structurally unrelated — Divi markup vs. clean EDS markup — so a single
// generic selector can't cover both sides; that mismatch was the #1 cause of bad readings during
// manual investigation). captureLive/captureEds run inside the browser via page.evaluate and each
// return { info, props }: `info` names the matched element (for verifying the selector actually
// hit the right node) and is never diffed; `props` is a flat dot-path map that IS diffed.
const BLOCKS = {
  'hero-banner': {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const section = document.querySelector('.et_pb_fullwidth_header');
        const overlay = document.querySelector('.banner-overlay');
        const h1 = section && section.querySelector('h1');
        const sub = section && section.querySelector('.et_pb_fullwidth_header_subhead');
        const box = section.getBoundingClientRect();
        const subBox = sub ? sub.getBoundingClientRect() : null;
        return {
          info: {
            root: `${section.tagName}.${section.className}`.slice(0, 60),
            h1: h1 ? h1.tagName : 'missing',
            sub: sub ? `${sub.tagName}.${sub.className}` : 'missing',
          },
          props: {
            sectionHeight: Math.round(box.height),
            padding: g(section, 'padding'),
            backgroundPosition: g(section, 'background-position'),
            overlayColor: overlay ? g(overlay, 'background-color') : null,
            'h1.fontSize': h1 && g(h1, 'font-size'),
            'h1.marginBottom': h1 && g(h1, 'margin-bottom'),
            'h1.color': h1 && g(h1, 'color'),
            subVisible: sub ? String(!!(subBox && subBox.width > 0 && subBox.height > 0 && g(sub, 'display') !== 'none')) : 'missing',
            'sub.fontSize': sub && g(sub, 'font-size'),
            'sub.fontWeight': sub && g(sub, 'font-weight'),
            'sub.lineHeight': sub && g(sub, 'line-height'),
          },
        };
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const gAfter = (el, p) => (el ? getComputedStyle(el, '::after').getPropertyValue(p) : null);
        const block = document.querySelector('.hero-banner');
        const h1 = block && block.querySelector('h1');
        const sub = block && block.querySelector('p');
        const img = block && block.querySelector('img');
        const box = block.getBoundingClientRect();
        const subBox = sub ? sub.getBoundingClientRect() : null;
        return {
          info: {
            root: `${block.tagName}.${block.className}`.slice(0, 60),
            h1: h1 ? h1.tagName : 'missing',
            sub: sub ? sub.tagName : 'missing',
          },
          props: {
            sectionHeight: Math.round(box.height),
            padding: g(block, 'padding'),
            backgroundPosition: img && g(img, 'object-position'),
            overlayColor: gAfter(block, 'background-image'),
            'h1.fontSize': h1 && g(h1, 'font-size'),
            'h1.marginBottom': h1 && g(h1, 'margin-bottom'),
            'h1.color': h1 && g(h1, 'color'),
            subVisible: sub ? String(!!(subBox && subBox.width > 0 && subBox.height > 0 && g(sub, 'display') !== 'none')) : 'missing',
            'sub.fontSize': sub && g(sub, 'font-size'),
            'sub.fontWeight': sub && g(sub, 'font-weight'),
            'sub.lineHeight': sub && g(sub, 'line-height'),
          },
        };
      });
    },
    contrastPairs: [
      { label: 'h1 vs overlay (approx — real bg is a photo)', textProp: 'h1.color', bgProp: 'overlayColor', fontSizeProp: 'h1.fontSize' },
    ],
  },

  cards: {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        ['welcomelink1', 'welcomelink2'].forEach((cls, i) => {
          const a = document.querySelector(`.${cls}`);
          const key = `card${i + 1}`;
          if (!a) { out.info[key] = 'not found'; return; }
          const wrapper = a.querySelector('.et_pb_module') || a;
          const inner = wrapper.querySelector('.et_pb_text_inner') || wrapper;
          const h4 = inner.querySelector('h4');
          // legacy body copy isn't reliably a <p> — take any sibling of the heading with text.
          const p = [...inner.children].find((el) => el !== h4 && el.textContent.trim().length > 0) || inner.querySelector('p');
          const box = wrapper.getBoundingClientRect();
          out.info[key] = `${a.tagName}.${a.className}`;
          out.props[`${key}.bg`] = g(wrapper, 'background-color');
          out.props[`${key}.padding`] = g(wrapper, 'padding');
          out.props[`${key}.height`] = Math.round(box.height);
          out.props[`${key}.title.fontSize`] = h4 && g(h4, 'font-size');
          out.props[`${key}.title.fontWeight`] = h4 && g(h4, 'font-weight');
          out.props[`${key}.title.color`] = h4 && g(h4, 'color');
          out.props[`${key}.body.fontSize`] = p && g(p, 'font-size');
          out.props[`${key}.body.color`] = p && g(p, 'color');
        });
        return out;
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const items = document.querySelectorAll('.cards.feature > ul > li');
        const out = { info: {}, props: {} };
        items.forEach((li, i) => {
          const key = `card${i + 1}`;
          const h3 = li.querySelector('h1,h2,h3,h4,h5,h6');
          const p = li.querySelector('p');
          const body = li.querySelector('.cards-card-body');
          const box = li.getBoundingClientRect();
          out.info[key] = `${li.tagName}.${li.className}`;
          out.props[`${key}.bg`] = g(li, 'background-color');
          out.props[`${key}.padding`] = g(body || li, 'padding');
          out.props[`${key}.height`] = Math.round(box.height);
          out.props[`${key}.title.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${key}.title.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${key}.title.color`] = h3 && g(h3, 'color');
          out.props[`${key}.body.fontSize`] = p && g(p, 'font-size');
          out.props[`${key}.body.color`] = p && g(p, 'color');
        });
        return out;
      });
    },
    contrastPairs: [
      { label: 'card1 title vs tile', textProp: 'card1.title.color', bgProp: 'card1.bg', fontSizeProp: 'card1.title.fontSize' },
      { label: 'card1 body vs tile', textProp: 'card1.body.color', bgProp: 'card1.bg', fontSizeProp: 'card1.body.fontSize' },
    ],
    hover: [
      { side: 'eds', selector: '.cards.feature > ul > li', prop: 'background-color' },
      { side: 'live', selector: '.welcomelink1', prop: 'background-color' },
    ],
  },

  columns: {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        const cols = document.querySelectorAll('.et_pb_row_4 .et_pb_column');
        [['positive', cols[0]], ['negative', cols[1]]].forEach(([label, col]) => {
          if (!col) { out.info[label] = 'not found'; return; }
          const h3 = col.querySelector('h3');
          const li = col.querySelector('li');
          out.info[label] = `${col.tagName}.${col.className}`.slice(0, 60);
          out.props[`${label}.heading.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${label}.heading.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${label}.heading.color`] = h3 && g(h3, 'color');
          out.props[`${label}.li.fontSize`] = li && g(li, 'font-size');
          out.props[`${label}.li.color`] = li && g(li, 'color');
          out.props[`${label}.marker.content`] = li && getComputedStyle(li, '::before').content;
          out.props[`${label}.marker.color`] = li && getComputedStyle(li, '::before').color;
        });
        return out;
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        [['positive', '.columns.compare .columns-positive'], ['negative', '.columns.compare .columns-negative']].forEach(([label, sel]) => {
          const col = document.querySelector(sel);
          if (!col) { out.info[label] = 'not found'; return; }
          const h3 = col.querySelector('h1,h2,h3,h4');
          const li = col.querySelector('li');
          out.info[label] = `${col.tagName}.${col.className}`.slice(0, 60);
          out.props[`${label}.heading.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${label}.heading.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${label}.heading.color`] = h3 && g(h3, 'color');
          out.props[`${label}.li.fontSize`] = li && g(li, 'font-size');
          out.props[`${label}.li.color`] = li && g(li, 'color');
          out.props[`${label}.marker.content`] = li && getComputedStyle(li, '::before').content;
          out.props[`${label}.marker.color`] = li && getComputedStyle(li, '::before').color;
        });
        return out;
      });
    },
    contrastPairs: [
      { label: 'positive text vs section bg', textProp: 'positive.li.color', bgProp: '__sectionBg', fontSizeProp: 'positive.li.fontSize' },
    ],
    // sections.characteristics background from source-baseline.json — flat color, safe to hardcode
    // here since it's a fixed design token, not something that varies per block.
    fixedProps: { __sectionBg: 'rgb(240, 242, 246)' },
  },

  'form-contact': {
    async captureLive(page) {
      try {
        const trigger = page.locator('.open-talk-to-us a, a:has-text("TALK TO US")').first();
        if (await trigger.count()) { await trigger.click({ timeout: 5000 }); await page.waitForTimeout(600); }
      } catch { /* modal trigger not found — capture will show button as 'not found' */ }
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const btn = document.querySelector('.form__field__input--button');
        const label = document.querySelector('.talk-to-us__form label, .form__field label');
        return {
          info: {
            button: btn ? `${btn.tagName}.${btn.className}`.slice(0, 60) : 'not found (modal may not have opened)',
            label: label ? `${label.tagName}.${label.className}` : 'not found',
          },
          props: {
            'button.bg': btn && g(btn, 'background-color'),
            'button.color': btn && g(btn, 'color'),
            'button.borderRadius': btn && g(btn, 'border-radius'),
            'button.padding': btn && g(btn, 'padding'),
            'button.fontWeight': btn && g(btn, 'font-weight'),
            'button.fontSize': btn && g(btn, 'font-size'),
            'label.fontSize': label && g(label, 'font-size'),
            'label.fontWeight': label && g(label, 'font-weight'),
            'label.color': label && g(label, 'color'),
            hasSemanticLabel: String(!!label),
          },
        };
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const btn = document.querySelector('.form-contact-submit');
        const label = document.querySelector('.form-contact-field label');
        return {
          info: {
            button: btn ? `${btn.tagName}.${btn.className}` : 'not found',
            label: label ? `${label.tagName}.${label.className}` : 'not found',
          },
          props: {
            'button.bg': btn && g(btn, 'background-color'),
            'button.color': btn && g(btn, 'color'),
            'button.borderRadius': btn && g(btn, 'border-radius'),
            'button.padding': btn && g(btn, 'padding'),
            'button.fontWeight': btn && g(btn, 'font-weight'),
            'button.fontSize': btn && g(btn, 'font-size'),
            'label.fontSize': label && g(label, 'font-size'),
            'label.fontWeight': label && g(label, 'font-weight'),
            'label.color': label && g(label, 'color'),
            hasSemanticLabel: String(!!label),
          },
        };
      });
    },
    contrastPairs: [
      { label: 'button text vs button bg', textProp: 'button.color', bgProp: 'button.bg', fontSizeProp: 'button.fontSize', fontWeightProp: 'button.fontWeight' },
    ],
    hover: [
      { side: 'eds', selector: '.form-contact-submit', prop: 'background-color' },
      { side: 'live', selector: '.form__field__input--button', prop: 'background-color' },
    ],
  },
};

const selectedBlocks = (arg('block') || Object.keys(BLOCKS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const selectedViewports = (arg('viewport') || Object.keys(VIEWPORTS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);

for (const b of selectedBlocks) {
  if (!BLOCKS[b]) { console.error(`Unknown block "${b}". Known: ${Object.keys(BLOCKS).join(', ')}`); process.exit(1); }
}
for (const v of selectedViewports) {
  if (!VIEWPORTS[v]) { console.error(`Unknown viewport "${v}". Known: ${Object.keys(VIEWPORTS).join(', ')}`); process.exit(1); }
}

const results = {}; // { block: { viewport: { liveInfo, edsInfo, rows, contrastRows, hoverRows } } }
const browser = await chromium.launch();

try {
  for (const vpName of selectedViewports) {
    const vp = VIEWPORTS[vpName];
    const livePage = await browser.newPage();
    const edsPage = await browser.newPage();
    await livePage.setViewportSize(vp);
    await edsPage.setViewportSize(vp);
    await livePage.goto(`${base}${path_}`, { waitUntil: 'networkidle', timeout: 30000 });
    await livePage.waitForTimeout(1000);
    // Dismiss the legacy cookie-consent banner — left open it overlaps content and blocks
    // Playwright's actionability checks (hover/click), causing spurious timeouts on the source side.
    try {
      const cookieBtn = livePage.locator('button:has-text("Accept all cookies")').first();
      if (await cookieBtn.count()) { await cookieBtn.click({ timeout: 3000 }); await livePage.waitForTimeout(300); }
    } catch { /* banner not present at this viewport/run — fine */ }
    await edsPage.goto(`${candidate}${path_}`, { waitUntil: 'networkidle', timeout: 30000 });
    await edsPage.waitForTimeout(1000);

    for (const blockName of selectedBlocks) {
      const spec = BLOCKS[blockName];
      let live;
      let eds;
      try {
        live = await spec.captureLive(livePage);
      } catch (e) { live = { info: { error: e.message.split('\n')[0] }, props: {} }; }
      try {
        eds = await spec.captureEds(edsPage);
      } catch (e) { eds = { info: { error: e.message.split('\n')[0] }, props: {} }; }

      const liveProps = { ...(spec.fixedProps || {}), ...live.props };
      const edsProps = { ...(spec.fixedProps || {}), ...eds.props };

      const keys = new Set([...Object.keys(liveProps), ...Object.keys(edsProps)]);
      const rows = [];
      for (const k of keys) {
        if (k.startsWith('__')) continue; // internal fixed-prop, not a real measured property
        const lv = liveProps[k];
        const ev = edsProps[k];
        if (lv == null && ev == null) continue;
        if (String(lv) === String(ev)) continue;
        rows.push({ prop: k, source: String(lv), migrated: String(ev), ...classify(k, lv, ev) });
      }

      const contrastRows = [];
      for (const pair of spec.contrastPairs || []) {
        for (const [sideLabel, props] of [['source', liveProps], ['migrated', edsProps]]) {
          const textColor = props[pair.textProp];
          const bgColor = pair.bgProp.startsWith('__') ? props[pair.bgProp] : props[pair.bgProp];
          const ratio = contrastRatio(textColor, bgColor);
          if (ratio == null) {
            contrastRows.push({ label: pair.label, side: sideLabel, ratio: 'n/a', note: 'non-flat or unparseable color' });
            continue;
          }
          const threshold = wcagAAThreshold(props[pair.fontSizeProp], props[pair.fontWeightProp]);
          contrastRows.push({
            label: pair.label, side: sideLabel, ratio: ratio.toFixed(2), threshold, pass: ratio >= threshold,
          });
        }
      }

      const hoverRows = [];
      if (vpName === 'desktop') { // hover state doesn't meaningfully vary by viewport — check once
        for (const h of spec.hover || []) {
          const targetPage = h.side === 'eds' ? edsPage : livePage;
          try {
            const before = await targetPage.evaluate((sel) => {
              const el = document.querySelector(sel);
              return el ? getComputedStyle(el).backgroundColor : null;
            }, h.selector);
            await targetPage.hover(h.selector, { timeout: 3000 });
            await targetPage.waitForTimeout(250);
            const after = await targetPage.evaluate((sel) => {
              const el = document.querySelector(sel);
              return el ? getComputedStyle(el).backgroundColor : null;
            }, h.selector);
            hoverRows.push({
              side: h.side, selector: h.selector, before, after, changed: before !== after,
            });
          } catch (e) {
            hoverRows.push({ side: h.side, selector: h.selector, error: e.message.split('\n')[0] });
          }
        }
      }

      results[blockName] = results[blockName] || {};
      results[blockName][vpName] = {
        liveInfo: live.info, edsInfo: eds.info, rows, contrastRows, hoverRows,
      };
    }
    await livePage.close();
    await edsPage.close();
  }
} finally {
  await browser.close();
}

// ---- report ----
let md = `# Block audit — ${path_}\n\nSource: ${base}${path_}\nMigrated: ${candidate}${path_}\nViewports: ${selectedViewports.join(', ')}\n\nLegend: 🔴 clear divergence · 🟡 minor · 🟢 negligible\n\n`;
let totalFlagged = 0;
let totalContrastFail = 0;

for (const blockName of selectedBlocks) {
  md += `## ${blockName}\n\n`;
  const firstVp = results[blockName][selectedViewports[0]];
  md += `**Matched elements** — source: \`${JSON.stringify(firstVp.liveInfo)}\`  \nmigrated: \`${JSON.stringify(firstVp.edsInfo)}\`\n\n`;

  for (const vpName of selectedViewports) {
    const r = results[blockName][vpName];
    md += `### ${vpName}\n\n`;
    if (r.rows.length) {
      totalFlagged += r.rows.filter((row) => row.icon !== '🟢').length;
      md += '| Property | Source | Migrated | Severity |\n|---|---|---|---|\n';
      for (const row of r.rows) md += `| ${row.prop} | ${row.source} | ${row.migrated} | ${row.icon} ${row.label} |\n`;
      md += '\n';
    } else {
      md += '✓ no differences\n\n';
    }
    if (r.contrastRows.length) {
      md += '**Contrast**\n\n| Pair | Side | Ratio | Threshold | Result |\n|---|---|---|---|---|\n';
      for (const c of r.contrastRows) {
        const result = c.pass === undefined ? (c.note || '—') : (c.pass ? '✅ pass' : '❌ FAIL');
        if (c.pass === false) totalContrastFail += 1;
        md += `| ${c.label} | ${c.side} | ${c.ratio} | ${c.threshold ? `${c.threshold}:1` : '—'} | ${result} |\n`;
      }
      md += '\n';
    }
    if (r.hoverRows.length) {
      md += '**Hover state (desktop)**\n\n| Side | Selector | Before | After | Changed |\n|---|---|---|---|---|\n';
      for (const h of r.hoverRows) {
        md += `| ${h.side} | \`${h.selector}\` | ${h.before || h.error || 'n/a'} | ${h.after || ''} | ${h.error ? '⚠️ error' : (h.changed ? '✅ yes' : '— no change')} |\n`;
      }
      md += '\n';
    }
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, md);
console.log(md);
console.log(`Full report written to ${outFile}`);
console.log(`\n${totalFlagged} non-negligible propert${totalFlagged === 1 ? 'y' : 'ies'} differ across ${selectedBlocks.length} block(s) × ${selectedViewports.length} viewport(s); ${totalContrastFail} contrast check(s) FAILED WCAG AA.`);
process.exit(0); // advisory — on-demand report, never blocks
