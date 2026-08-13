#!/usr/bin/env node
/**
 * broadridge-visual-compare — GENERIC, content-anchored parity check. Unlike
 * broadridge-block-audit.mjs (which needs a hand-written capture spec per block),
 * this compares ANY two subtrees with zero per-block code: it walks each side,
 * reduces every salient node to a descriptor (role + normalized text + geometry
 * + style set), then MATCHES source→migrated nodes by content fingerprint
 * (role + text) — not by selector — because the two DOMs are unrelated (legacy
 * markup vs clean EDS) yet the text is the same. Matched pairs get style/geometry
 * diffed; unmatched SOURCE nodes are reported as MISSING content, migrated-only
 * nodes as additions. See docs/broadridge-VISUAL-TESTING.md.
 *
 * Two modes:
 *   --page <path>                        whole page (source main vs migrated main)
 *   --source-selector <css> --dest-selector <css>   one region/block on each side
 *
 * Usage:
 *   node tools/quality/broadridge-visual-compare.mjs --page /cit
 *   node tools/quality/broadridge-visual-compare.mjs \
 *     --source-selector ".et_pb_fullwidth_header" --dest-selector ".hero-banner" --path /cit
 * Options:
 *   --base <url>        source origin (default config.parityBase)
 *   --candidate <url>   migrated origin (default config.localCandidate)
 *   --path <p>          page path applied to both origins (default /cit)
 *   --viewport <list>   comma list (default mobile,tablet,desktop)
 *   --allowlist <file>  JSON of accepted deviations (default visual-diff-allowlist.json)
 *   --strict            exit non-zero when unexplained 🔴 divergences remain
 *   --out <file>        markdown report (default visual-output/compare.md)
 *
 * Advisory by default (exit 0); --strict makes it gate. Needs playwright.
 */
import {
  readFileSync, mkdirSync, writeFileSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  matchNodes, diffMatchedNode, normalizeText,
  contrastRatio, wcagAAThreshold,
  horizontalSide, layoutRelation, auditSectionTransitions,
} from './lib/style-audit-utils.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('broadridge:compare needs playwright. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const ROOT = process.cwd();
let config = {};
try { config = JSON.parse(readFileSync(join(ROOT, 'tools/quality/broadridge-visual.config.json'), 'utf8')); } catch { /* optional */ }

const pagePath = arg('page') || arg('path', '/cit');
const base = (arg('base', config.parityBase) || '').replace(/\/+$/, '');
const candidate = (arg('candidate', config.localCandidate) || '').replace(/\/+$/, '');
const sourceSelector = arg('source-selector');
const destSelector = arg('dest-selector');
const strict = hasFlag('strict');
const outDir = join(ROOT, 'tools/quality/visual-output');
const outFile = arg('out', join(outDir, 'compare.md'));
const allowlistPath = arg('allowlist', join(ROOT, 'tools/quality/visual-diff-allowlist.json'));

// page mode compares the page body/main; block mode compares the given selectors.
const pageMode = !sourceSelector && !destSelector;
if (!pageMode && (!sourceSelector || !destSelector)) {
  console.error('Block mode needs BOTH --source-selector and --dest-selector (or use --page for whole-page).');
  process.exit(1);
}
if (!base || !candidate) {
  console.error('No base/candidate — set parityBase/localCandidate in the config or pass --base/--candidate.');
  process.exit(1);
}

let allowlist = [];
try {
  if (existsSync(allowlistPath)) {
    const raw = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    // accept a bare array, { compare: [...] }, or { compare: { entries: [...] } }
    const c = Array.isArray(raw) ? raw : (raw.compare || raw.entries || []);
    allowlist = Array.isArray(c) ? c : (c.entries || []);
  }
} catch { /* optional */ }

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
};
const selectedViewports = (arg('viewport') || Object.keys(VIEWPORTS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);

// The style props compared on each matched node. Generic and role-agnostic; the
// diff only surfaces the ones that actually differ and aren't negligible.
const STYLE_PROPS = [
  'color', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-transform', 'text-decoration-line', 'background-color', 'border-radius', 'text-align',
];

// Capture a flat, ordered descriptor list for one subtree (runs in the browser).
async function capture(pageObj, selector) {
  return pageObj.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : (document.querySelector('main') || document.body);
    if (!root) return { found: false, nodes: [] };
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const roleOfTag = (el) => {
      const t = el.tagName.toLowerCase();
      if (el.querySelector(':scope > img, :scope > svg, :scope > picture') || t === 'img' || t === 'svg' || t === 'picture') return 'image';
      if (/^h[1-6]$/.test(t)) return `heading${t.slice(1)}`;
      if (t === 'a') return 'link';
      if (t === 'li') return 'listitem';
      if (t === 'button') return 'button';
      if (t === 'p') return 'text';
      return null;
    };
    // Only capture "salient" leaf-ish nodes: headings, links, list items,
    // buttons, paragraphs, images. Skip pure layout wrappers.
    const SEL = 'h1,h2,h3,h4,h5,h6,a,li,button,p,img';
    // logical text-align keywords compute to physical sides in LTR; normalize so
    // `start` (EDS default) doesn't read as a diff against the source's `left`.
    const normAlign = (v) => ({ start: 'left', end: 'right' }[v] || v);
    const nodes = [];
    root.querySelectorAll(SEL).forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.display === 'none' || cs.visibility === 'hidden') return;
      const role = roleOfTag(el);
      if (!role) return;
      // de-dupe li↔link: an <li> whose only interactive content is a single link
      // would be captured twice (once as listitem, once as link). Keep the link
      // (carries href/role) and skip the wrapping li.
      const tag = el.tagName.toLowerCase();
      if (tag === 'li') {
        const inner = el.querySelectorAll('a, button');
        if (inner.length === 1 && norm(inner[0].textContent) === norm(el.textContent)) return;
      }
      const img = tag === 'img' ? el : el.querySelector('img');
      const styles = {};
      ['color', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line', 'background-color', 'border-radius', 'text-align'].forEach((p) => { styles[p] = p === 'text-align' ? normAlign(cs.getPropertyValue(p)) : cs.getPropertyValue(p); });
      // effective background: walk ancestors until a non-transparent color is found,
      // so WCAG contrast can be computed for text drawn on an inherited background.
      // If we hit an ancestor with a background IMAGE, or one that contains a
      // positioned <picture>/<img> acting as a background layer (hero over a photo),
      // contrast can't be read from a flat color — leave it null so it's skipped
      // rather than reported as a false fail.
      const hasPhotoLayer = (a) => [...a.querySelectorAll(':scope picture, :scope > img, :scope > div > picture')]
        .some((p) => { const ps = getComputedStyle(p); return ps.position === 'absolute' || ps.position === 'fixed'; });
      const solidBg = (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
      let effBg = null;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const acs = getComputedStyle(a);
        const hasBgImage = acs.backgroundImage && acs.backgroundImage !== 'none';
        if (hasBgImage || hasPhotoLayer(a)) { effBg = null; break; }
        if (solidBg(acs.backgroundColor)) { effBg = acs.backgroundColor; break; }
        // a full-bleed band is often painted by a ::before/::after pseudo-element,
        // which the element's own background-color misses — check those too.
        const beforeBg = getComputedStyle(a, '::before').backgroundColor;
        const afterBg = getComputedStyle(a, '::after').backgroundColor;
        if (solidBg(beforeBg)) { effBg = beforeBg; break; }
        if (solidBg(afterBg)) { effBg = afterBg; break; }
      }
      nodes.push({
        role,
        text: role === 'image' ? '' : norm(el.textContent).slice(0, 120),
        src: img ? img.getAttribute('src') : null,
        box: {
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        },
        styles,
        effectiveBg: effBg,
      });
    });
    const rb = root.getBoundingClientRect();
    // section descriptors (for the section-transition check) — only meaningful for
    // a page-level root, where `main > .section` exists.
    const sections = [...document.querySelectorAll('main > .section')].map((s) => {
      const cs = getComputedStyle(s);
      const b = s.getBoundingClientRect();
      return {
        top: b.top,
        bottom: b.bottom,
        height: b.height,
        bg: cs.backgroundColor,
        marginTop: parseFloat(cs.marginTop) || 0,
        marginBottom: parseFloat(cs.marginBottom) || 0,
        empty: s.children.length === 0 && s.textContent.trim() === '',
      };
    });
    return {
      found: true,
      rootTag: `${root.tagName}.${(root.className || '').toString().trim().split(/\s+/)[0] || ''}`,
      rootCenterX: Math.round(rb.x + rb.width / 2),
      nodes,
      sections,
    };
  }, selector || null);
}

const rows = []; // report rows across viewports
const browser = await chromium.launch();
try {
  for (const vpName of selectedViewports) {
    const vp = VIEWPORTS[vpName];
    const srcPage = await browser.newPage();
    const migPage = await browser.newPage();
    await srcPage.setViewportSize(vp);
    await migPage.setViewportSize(vp);
    await srcPage.goto(`${base}${pagePath}`, { waitUntil: 'networkidle', timeout: 30000 });
    // dismiss the legacy cookie banner (blocks capture/scroll on the source side)
    try {
      const cb = srcPage.locator('button:has-text("Accept all cookies")').first();
      if (await cb.count()) { await cb.click({ timeout: 3000 }); await srcPage.waitForTimeout(300); }
    } catch { /* none */ }
    await srcPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await srcPage.waitForTimeout(800);
    await migPage.goto(`${candidate}${pagePath}`, { waitUntil: 'networkidle', timeout: 30000 });
    await migPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await migPage.waitForTimeout(800);

    const src = await capture(srcPage, sourceSelector);
    const mig = await capture(migPage, destSelector);

    // Hover-state check (desktop only — hover doesn't vary by viewport). For a
    // bounded set of interactive nodes on the migrated side, does the resting
    // style change on :hover? Generic version of the hand-spec `hover` list — it
    // confirms links/buttons have SOME hover affordance rather than being inert.
    // Uses REAL pointer movement (page.mouse.move) — synthetic MouseEvents do not
    // trigger the CSS :hover pseudo-class, so dispatching events would be useless.
    let hoverRows = [];
    if (vpName === 'desktop' && mig.found) {
      // collect bounded interactive targets: center point + resting style
      const targets = await migPage.evaluate((rootSel) => {
        const root = rootSel ? document.querySelector(rootSel) : (document.querySelector('main') || document.body);
        if (!root) return [];
        return [...root.querySelectorAll('a[href], button')]
          .map((el) => { const r = el.getBoundingClientRect(); return { el, r }; })
          .filter(({ r, el }) => r.width > 1 && r.height > 1 && el.textContent.trim())
          .slice(0, 12)
          .map(({ el, r }, i) => {
            el.setAttribute('data-hover-probe', String(i));
            const c = getComputedStyle(el);
            return {
              i, label: el.textContent.trim().slice(0, 28), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), before: `${c.color}|${c.backgroundColor}|${c.textDecorationLine}`,
            };
          });
      }, destSelector || null);
      for (const t of targets) {
        try {
          await migPage.mouse.move(t.cx, t.cy);
          // eslint-disable-next-line no-await-in-loop
          await migPage.waitForTimeout(60);
          // eslint-disable-next-line no-await-in-loop
          const after = await migPage.evaluate((idx) => {
            const el = document.querySelector(`[data-hover-probe="${idx}"]`);
            if (!el) return null;
            const c = getComputedStyle(el);
            return `${c.color}|${c.backgroundColor}|${c.textDecorationLine}`;
          }, t.i);
          hoverRows.push({ label: t.label, changed: after != null && after !== t.before });
        } catch { hoverRows.push({ label: t.label, changed: false, error: true }); }
      }
    }

    await srcPage.close();
    await migPage.close();

    // Silent-mismatch guard: a selector that matched nothing / an empty subtree
    // is a 🔴, never a silent pass.
    if (!src.found || !mig.found || !src.nodes.length || !mig.nodes.length) {
      rows.push({
        vpName,
        fatal: `capture empty — source ${src.found ? `${src.nodes.length} nodes` : 'NOT FOUND'}, migrated ${mig.found ? `${mig.nodes.length} nodes` : 'NOT FOUND'}`,
      });
      continue;
    }

    const { pairs, missing, added } = matchNodes(src.nodes, mig.nodes);
    // style drift on matched pairs
    const styleRows = [];
    // full element-by-element inventory (every matched node + its per-prop verdict)
    const inventory = [];
    // per-node WCAG contrast (text color vs effective background), both sides
    const contrastRows = [];
    for (const pair of pairs) {
      const label = `${pair.source.role} "${(pair.source.text || pair.source.src || '').slice(0, 32)}"`;
      const drift = diffMatchedNode(pair, STYLE_PROPS);
      for (const d of drift) styleRows.push({ node: label, ...d });
      // inventory row: worst severity across this node's props
      const worst = drift.reduce((acc, d) => (d.icon === '🔴' ? '🔴' : (acc === '🔴' ? '🔴' : d.icon)), drift.length ? '🟡' : '🟢');
      inventory.push({
        label,
        role: pair.source.role,
        props: drift.length,
        verdict: drift.length ? worst : '🟢 match',
        driftKeys: drift.map((d) => d.prop).join(', '),
      });
      // contrast, each side (only for text-bearing roles with a parseable bg)
      if (pair.source.role !== 'image') {
        for (const [side, node] of [['source', pair.source], ['migrated', pair.migrated]]) {
          const ratio = contrastRatio(node.styles.color, node.effectiveBg);
          if (ratio == null) continue;
          const threshold = wcagAAThreshold(node.styles['font-size'], node.styles['font-weight']);
          contrastRows.push({
            node: label, side, ratio: ratio.toFixed(2), threshold, pass: ratio >= threshold,
          });
        }
      }
    }

    // Alignment: for each matched node, which side of the root it sits on — flags
    // mirrored layouts (e.g. a control that moved left↔right). Generic version of
    // the hand-spec `alignmentPairs`, keyed on matched content.
    const alignmentRows = [];
    for (const pair of pairs) {
      const sSide = horizontalSide(pair.source.box.x + pair.source.box.w / 2, src.rootCenterX);
      const mSide = horizontalSide(pair.migrated.box.x + pair.migrated.box.w / 2, mig.rootCenterX);
      if (sSide && mSide && sSide !== mSide) {
        alignmentRows.push({
          node: `${pair.source.role} "${(pair.source.text || pair.source.src || '').slice(0, 28)}"`,
          source: sSide,
          migrated: mSide,
        });
      }
    }

    // Layout composition: relation between the first two DISTINCT-region anchors
    // (first heading vs first list/link cluster) on each side — beside vs below.
    // Generic version of the hand-spec `regionPairs`/`layoutRelation`.
    const layoutRows = [];
    const anchorPair = (nodes) => {
      const a = nodes.find((n) => /^heading/.test(n.role) || n.role === 'text');
      const bNode = nodes.find((n) => (n.role === 'listitem' || n.role === 'link') && n !== a);
      return a && bNode ? [a, bNode] : null;
    };
    const sa = anchorPair(src.nodes);
    const ma = anchorPair(mig.nodes);
    if (sa && ma) {
      const sRel = layoutRelation(sa[0].box, sa[1].box);
      const mRel = layoutRelation(ma[0].box, ma[1].box);
      if (sRel !== mRel) {
        layoutRows.push({ aspect: 'lead text vs first list/link cluster', source: sRel || 'n/a', migrated: mRel || 'n/a' });
      }
    }

    rows.push({
      vpName,
      srcCount: src.nodes.length,
      migCount: mig.nodes.length,
      srcRoot: src.rootTag,
      migRoot: mig.rootTag,
      matched: pairs.length,
      missing,
      added,
      styleRows,
      inventory,
      contrastRows,
      alignmentRows,
      layoutRows,
      hoverRows,
      sectionIssues: pageMode ? auditSectionTransitions(mig.sections || []) : [],
      matchRate: pairs.length / Math.max(1, src.nodes.length),
    });
  }
} finally {
  await browser.close();
}

// ---- allowlist filtering (accepted deviations) ----
const isAllowed = (kind, text) => allowlist.some((a) => {
  if (a.kind && a.kind !== kind) return false;
  if (a.textMatch && !normalizeText(text || '').includes(normalizeText(a.textMatch))) return false;
  return !!(a.textMatch || a.kind);
});

// ---- report ----
const md5 = (n) => (n.text || n.src || '').replace(/\|/g, '\\|').slice(0, 60);
const cell = (v) => String(v == null ? '—' : v).replace(/\|/g, '\\|');
const realMissingOf = (r) => r.missing.filter((n) => (n.text || n.src) && !isAllowed('missing', n.text));
const realAddedOf = (r) => r.added.filter((n) => (n.text || n.src) && !isAllowed('added', n.text));

const modeLabel = pageMode ? `page ${pagePath}` : `${sourceSelector}  →  ${destSelector}`;
let md = `# Visual compare (generic, content-anchored) — ${modeLabel}\n\n`;
md += `Source: ${base}${pagePath}  \nMigrated: ${candidate}${pagePath}  \nMode: ${pageMode ? 'whole-page' : 'block/region (selector)'}  \nViewports: ${selectedViewports.join(', ')}\n\n`;
md += 'Legend: 🔴 clear divergence · 🟡 minor · 🟢 match · missing = in source, absent in migration · added = migration-only\n\n';

let hardFindings = 0;
let contrastFails = 0;

// ---- summary matrix (per viewport) ----
md += '## Summary\n\n';
md += '| Viewport | Src nodes | Mig nodes | Matched | Match rate | Style drift (🔴/🟡) | Missing | Added | Contrast fails | Align | Layout | Section | No-hover |\n';
md += '|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  if (r.fatal) { md += `| ${r.vpName} | — | — | — | — | — | — | — | 🔴 ${cell(r.fatal)} | — | — | — | — |\n`; continue; }
  const red = r.styleRows.filter((s) => s.icon === '🔴').length;
  const yellow = r.styleRows.filter((s) => s.icon === '🟡').length;
  const cFail = r.contrastRows.filter((c) => c.pass === false).length;
  const noHover = (r.hoverRows || []).filter((h) => !h.changed && !h.error).length;
  md += `| ${r.vpName} | ${r.srcCount} | ${r.migCount} | ${r.matched} | ${(r.matchRate * 100).toFixed(0)}% | ${red}/${yellow} | ${realMissingOf(r).length} | ${realAddedOf(r).length} | ${cFail} | ${r.alignmentRows.length} | ${r.layoutRows.length} | ${(r.sectionIssues || []).length} | ${noHover} |\n`;
}
md += `\nMatched elements — source root \`${rows.find((r) => r.srcRoot)?.srcRoot || '?'}\` → migrated root \`${rows.find((r) => r.migRoot)?.migRoot || '?'}\`\n\n`;

// ---- Condensed findings (pivot: one row per finding, viewports as columns) ----
// Mirrors the hand-spec audit's cross-viewport table so a reviewer reads a single
// row per property and sees mobile/tablet/desktop side by side with one severity.
const vps = rows.filter((r) => !r.fatal).map((r) => r.vpName);
const findings = new Map(); // key -> { property, cells:{vp:text}, sev }
const sevRank = { '🔴': 3, '🟡': 2, '🟢': 1 };
const bumpSev = (f, icon) => { if (sevRank[icon] > sevRank[f.sev]) f.sev = icon; };
const ensure = (key, property) => {
  if (!findings.has(key)) findings.set(key, { property, cells: {}, sev: '🟢' });
  return findings.get(key);
};
for (const r of rows) {
  if (r.fatal) continue;
  // style drift → "source→migrated" per viewport
  for (const s of r.styleRows) {
    const f = ensure(`${s.node} · ${s.prop}`, `${s.node} — ${s.prop}`);
    f.cells[r.vpName] = `${s.source}→${s.migrated}`;
    bumpSev(f, s.icon);
  }
  // missing content → "missing" per viewport
  for (const n of realMissingOf(r)) {
    const f = ensure(`missing · ${n.role} · ${normalizeText(n.text || n.src)}`, `missing: ${n.role} “${(n.text || n.src || '').slice(0, 32)}”`);
    f.cells[r.vpName] = 'missing';
    bumpSev(f, '🔴');
  }
  // contrast failures → ratio per viewport
  for (const c of r.contrastRows.filter((x) => x.pass === false)) {
    const f = ensure(`contrast · ${c.node}`, `contrast: ${c.node} (${c.side})`);
    f.cells[r.vpName] = `${c.ratio}<${c.threshold}`;
    bumpSev(f, '🔴');
  }
  // alignment mismatch (mirrored layout) → side pair per viewport
  for (const a of r.alignmentRows) {
    const f = ensure(`align · ${a.node}`, `alignment: ${a.node}`);
    f.cells[r.vpName] = `${a.source}→${a.migrated}`;
    bumpSev(f, '🔴');
  }
  // layout composition (beside vs below) → relation pair per viewport
  for (const l of r.layoutRows) {
    const f = ensure(`layout · ${l.aspect}`, `layout: ${l.aspect}`);
    f.cells[r.vpName] = `${l.source}→${l.migrated}`;
    bumpSev(f, '🔴');
  }
  // section transitions (page mode) → the smell per viewport
  for (const si of r.sectionIssues || []) {
    const f = ensure(`section · ${si.kind} · ${si.between || si.at}`, `section: ${si.kind} @ ${si.between || `#${si.at}`}`);
    f.cells[r.vpName] = si.detail.slice(0, 24);
    bumpSev(f, si.severity);
  }
  // hover: matched interactive nodes that show NO hover affordance (advisory 🟡)
  for (const h of (r.hoverRows || []).filter((x) => !x.changed && !x.error)) {
    const f = ensure(`hover · ${h.label}`, `hover: “${h.label}” no state change`);
    f.cells[r.vpName] = 'no hover';
    bumpSev(f, '🟡');
  }
}
// only show findings that actually diverge somewhere (skip all-🟢 noise)
const findingRows = [...findings.values()].filter((f) => f.sev !== '🟢')
  .sort((a, b) => sevRank[b.sev] - sevRank[a.sev]);
if (findingRows.length) {
  md += '## Condensed findings\n\n';
  md += `| Property | ${vps.join(' | ')} | Severity |\n|---|${vps.map(() => '---').join('|')}|---|\n`;
  for (const f of findingRows) {
    const cells = vps.map((v) => cell(f.cells[v] || '✓'));
    md += `| ${cell(f.property)} | ${cells.join(' | ')} | ${f.sev} |\n`;
  }
  md += '\n> `source→migrated` = differing values · `✓` = matches at that viewport · `missing` = absent in migration · `ratio<threshold` = WCAG fail\n\n';
}

for (const r of rows) {
  md += `## ${r.vpName}\n\n`;
  if (r.fatal) { md += `🔴 **${r.fatal}**\n\n`; hardFindings += 1; continue; }
  md += `Matched ${r.matched} of ${r.srcCount} source node(s) — match rate ${(r.matchRate * 100).toFixed(0)}%.\n\n`;

  // full element-by-element inventory (matches the hand-spec audit's thoroughness)
  md += '**Element inventory (every matched node)**\n\n| Element | Role | Props diffing | Verdict |\n|---|---|---|---|\n';
  for (const it of r.inventory) {
    md += `| ${cell(it.label)} | ${it.role} | ${it.props ? cell(it.driftKeys) : '—'} | ${it.verdict} |\n`;
  }
  md += '\n';

  const realMissing = realMissingOf(r);
  if (realMissing.length) {
    md += '**Missing content (in source, not in migration)**\n\n| Role | Content |\n|---|---|\n';
    for (const n of realMissing) { md += `| ${n.role} | ${md5(n)} |\n`; hardFindings += 1; }
    md += '\n';
  }
  const realAdded = realAddedOf(r);
  if (realAdded.length) {
    md += '**Added content (migration-only)**\n\n| Role | Content |\n|---|---|\n';
    for (const n of realAdded) md += `| ${n.role} | ${md5(n)} |\n`;
    md += '\n';
  }
  if (r.styleRows.length) {
    md += '**Style drift on matched nodes**\n\n| Node | Property | Source | Migrated | Severity |\n|---|---|---|---|---|\n';
    for (const s of r.styleRows) {
      if (s.icon === '🔴') hardFindings += 1;
      md += `| ${cell(s.node)} | ${s.prop} | ${cell(s.source)} | ${cell(s.migrated)} | ${s.icon} ${s.label} |\n`;
    }
    md += '\n';
  }
  if (r.contrastRows.length) {
    md += '**Contrast (WCAG AA, text vs effective background)**\n\n| Node | Side | Ratio | Threshold | Result |\n|---|---|---|---|---|\n';
    for (const c of r.contrastRows) {
      if (c.pass === false) contrastFails += 1;
      md += `| ${cell(c.node)} | ${c.side} | ${c.ratio} | ${c.threshold}:1 | ${c.pass ? '✅ pass' : '❌ FAIL'} |\n`;
    }
    md += '\n';
  }
  if (r.alignmentRows.length) {
    md += '**Alignment (which side of the root — mirrored layouts)**\n\n| Node | Source | Migrated | Result |\n|---|---|---|---|\n';
    for (const a of r.alignmentRows) { hardFindings += 1; md += `| ${cell(a.node)} | ${a.source} | ${a.migrated} | 🔴 mirrored |\n`; }
    md += '\n';
  }
  if (r.layoutRows.length) {
    md += '**Layout composition (relative position)**\n\n| Aspect | Source | Migrated | Result |\n|---|---|---|---|\n';
    for (const l of r.layoutRows) { hardFindings += 1; md += `| ${cell(l.aspect)} | ${l.source} | ${l.migrated} | 🔴 differs |\n`; }
    md += '\n';
  }
  if ((r.sectionIssues || []).length) {
    md += '**Section transitions (page)**\n\n| Kind | Where | Severity | Detail |\n|---|---|---|---|\n';
    for (const si of r.sectionIssues) md += `| ${si.kind} | ${si.between || `#${si.at}`} | ${si.severity} | ${cell(si.detail)} |\n`;
    md += '\n';
  }
  if (r.hoverRows && r.hoverRows.length) {
    md += '**Hover state (desktop — migrated interactive nodes)**\n\n| Node | Hover changes style? |\n|---|---|\n';
    for (const h of r.hoverRows) md += `| ${cell(h.label)} | ${h.error ? '⚠️ error' : (h.changed ? '✅ yes' : '— none')} |\n`;
    md += '\n';
  }
  if (!realMissing.length && !realAdded.length && !r.styleRows.length && !r.alignmentRows.length && !r.layoutRows.length) md += '✓ no content, style, or layout divergence\n\n';
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, md);
console.log(md);
console.log(`Report written to ${outFile}`);
const totalMissing = rows.reduce((s, r) => s + (r.missing ? realMissingOf(r).length : 0), 0);
console.log(`\n${hardFindings} hard finding(s): ${totalMissing} missing-content + style/fatal; ${contrastFails} contrast FAIL(s). ${strict ? '(strict)' : '(advisory)'}`);
if (strict && (hardFindings > 0 || contrastFails > 0)) process.exit(1);
process.exit(0);
