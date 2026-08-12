#!/usr/bin/env node
/**
 * broadridge-visual-check — visual-regression diff of production/live (before) vs the current
 * branch (after). See docs/broadridge-VISUAL-TESTING.md.
 *
 * Screenshots each manifest path at mobile/tablet/desktop on BOTH base and candidate, pads the two
 * full-page images to a common canvas (pixelmatch needs equal dimensions), diffs them, and writes
 * before/after/diff PNGs. Missing/404 targets are skipped with a warning — never a crash (important
 * during migration when a page exists on only one side).
 *
 * Usage:
 *   node tools/quality/broadridge-visual-check.mjs --base <url> --candidate <url> [options]
 * Options:
 *   --manifest <path>   default tools/quality/broadridge-visual-targets.json
 *   --out <dir>         default tools/quality/visual-output
 *   --threshold <ratio> default 0.001 (0.1% of pixels)
 *   --path <p>          only this manifest path
 *   --report-only       never exit non-zero (just report)
 *
 * Needs dev deps: playwright (saved) + pixelmatch + pngjs. Run browsers once: npx playwright install chromium
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

// ---- deps (lazy so a clear message shows if they're missing) ----
let chromium;
let pixelmatch;
let PNG;
try {
  ({ chromium } = await import('playwright'));
  ({ default: pixelmatch } = await import('pixelmatch'));
  ({ PNG } = await import('pngjs'));
} catch {
  console.error('broadridge:test:visual needs dev deps. Run:');
  console.error('  npm i -D playwright pixelmatch pngjs && npx playwright install chromium');
  process.exit(1);
}

// ---- args ----
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

// Project defaults live in a config file so day-to-day you only pass --scope / --path / --block.
// Any --flag overrides the config; a manifest target may override per page.
const configPath = arg('config', 'tools/quality/broadridge-visual.config.json');
let config = {};
try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* config is optional */ }

const mode = arg('mode', 'regression'); // 'regression' → config.regressionBase | 'parity' → config.parityBase
const base = arg('base') || (mode === 'parity' ? config.parityBase : config.regressionBase) || null;
const candidate = arg('candidate') || config.localCandidate || null;
const manifestPath = arg('manifest', 'tools/quality/broadridge-visual-targets.json');
const outDir = arg('out', 'tools/quality/visual-output');
const threshold = arg('threshold') ? parseFloat(arg('threshold')) : (typeof config.threshold === 'number' ? config.threshold : 0.001);
const onlyPath = arg('path');
const reportOnly = hasFlag('report-only');
const scope = arg('scope', 'fullpage'); // 'fullpage' (whole page) or 'block' (a single element)
const cliBlock = arg('block'); // block-scope default: EDS block name → `.name` (applies to targets lacking one)
const cliSelector = arg('selector'); // block-scope default: raw CSS selector
const cliBaseSelector = arg('base-selector'); // block-scope: selector for the base side only (legacy markup)

// base/candidate above come from --flag, else the config (by mode), else null. A manifest target may
// still carry its own full `base`/`candidate` URLs (PR-supplied). Targets that resolve to neither are skipped.

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
};

const stripTrailing = (u) => u.replace(/\/+$/, '');
const slug = (s) => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`Cannot read manifest ${manifestPath}: ${e.message}`);
  process.exit(1);
}
if (onlyPath) manifest = manifest.filter((t) => t.path === onlyPath);
if (!manifest.length) { console.error('No targets to check.'); process.exit(reportOnly ? 0 : 1); }

mkdirSync(outDir, { recursive: true });

/**
 * Screenshot url at a viewport → { ok, buffer }. With `selector`, captures just that element
 * (block-level); otherwise the full page. ok:false on non-200, nav error, or missing selector.
 */
async function shoot(browser, url, vp, selector) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(vp);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || resp.status() >= 400) return { ok: false, reason: `HTTP ${resp ? resp.status() : 'no-response'}` };
    await page.waitForTimeout(1500); // settle animations/fonts
    let buffer;
    if (selector) {
      if (await page.locator(selector).count() === 0) return { ok: false, reason: `selector ${selector} not found` };
      const el = page.locator(selector).first();
      await el.scrollIntoViewIfNeeded();
      buffer = await el.screenshot();
    } else {
      buffer = await page.screenshot({ fullPage: true });
    }
    return { ok: true, buffer };
  } catch (e) {
    return { ok: false, reason: e.message.split('\n')[0] };
  } finally {
    await page.close();
  }
}

/**
 * Composite an image ({ width, height, data }) onto a white W×H canvas (top-left) so both diff
 * inputs share dimensions. Uses typed-array copy — `PNG.sync.read()` returns a plain object without
 * the `bitblt` instance method, so we don't rely on it.
 */
function padTo(src, W, H) {
  const canvas = new PNG({ width: W, height: H });
  canvas.data.fill(255); // opaque white
  const rowBytes = src.width * 4;
  for (let y = 0; y < src.height; y += 1) {
    const srcRow = src.data.subarray(y * rowBytes, y * rowBytes + rowBytes);
    canvas.data.set(srcRow, y * W * 4);
  }
  return canvas;
}

const rows = [];
const browser = await chromium.launch();
try {
  for (const target of manifest) {
    const cfgVps = Array.isArray(config.viewports) && config.viewports.length ? config.viewports : Object.keys(VIEWPORTS);
    const vps = (target.viewports && target.viewports.length ? target.viewports : cfgVps);
    for (const vpName of vps) {
      const vp = VIEWPORTS[vpName];
      if (!vp) { console.warn(`skip unknown viewport "${vpName}"`); continue; }
      const label = `${target.path} @ ${vpName}`;
      // Domains come from the config (regressionBase/parityBase/localCandidate); the target supplies
      // the PATHS. Destination (candidate) uses `path`; source (base) uses `path` too, unless the legacy
      // page lives at a different route — then set `legacyPath` (used for the parity source only).
      // A full-URL `base`/`candidate` on the target still overrides everything if ever needed.
      const srcPath = (mode === 'parity' && target.legacyPath) ? target.legacyPath : target.path;
      const baseUrl = target.base || (base ? stripTrailing(base) + srcPath : null);
      const candUrl = target.candidate || (candidate ? stripTrailing(candidate) + target.path : null);
      if (!baseUrl || !candUrl) {
        rows.push({ label, status: 'skipped', detail: 'no base/candidate URL' });
        console.warn(`⚠ ${label} — skipped (no base/candidate URL — set --base/--candidate or target.base/candidate)`);
        continue;
      }
      // Block scope: capture a single element. `block` maps to the EDS class `.block`; `selector`/
      // `baseSelector` are raw CSS overrides (baseSelector is for the legacy side in parity mode).
      let candSel = null;
      let baseSel = null;
      if (scope === 'block') {
        const blockName = target.block || cliBlock;
        candSel = target.selector || cliSelector || (blockName ? `.${blockName}` : null);
        // baseSelector describes the LEGACY element, so it only applies when the base is the legacy
        // site (parity). In regression both sides are EDS → the base uses the same block selector.
        baseSel = (mode === 'parity' ? (target.baseSelector || cliBaseSelector) : null) || candSel;
        if (!candSel) {
          rows.push({ label, status: 'skipped', detail: 'block scope needs block= or selector=' });
          console.warn(`⚠ ${label} — skipped (block scope needs block= or selector=)`);
          continue;
        }
      }
      const [b, c] = await Promise.all([
        shoot(browser, baseUrl, vp, baseSel),
        shoot(browser, candUrl, vp, candSel),
      ]);
      if (!b.ok || !c.ok) {
        const why = [!b.ok && `base ${b.reason}`, !c.ok && `candidate ${c.reason}`].filter(Boolean).join(', ');
        rows.push({ label, status: 'skipped', detail: why });
        console.warn(`⚠ ${label} — skipped (${why})`);
        continue;
      }
      const basePng = PNG.sync.read(b.buffer);
      const candPng = PNG.sync.read(c.buffer);
      const W = Math.max(basePng.width, candPng.width);
      const H = Math.max(basePng.height, candPng.height);
      const bp = padTo(basePng, W, H);
      const cp = padTo(candPng, W, H);
      const diff = new PNG({ width: W, height: H });
      const changed = pixelmatch(bp.data, cp.data, diff.data, W, H, { threshold: 0.1, includeAA: false });
      const ratio = changed / (W * H);
      const stem = join(outDir, `${slug(target.path)}-${vpName}`);
      writeFileSync(`${stem}-before.png`, PNG.sync.write(bp));
      writeFileSync(`${stem}-after.png`, PNG.sync.write(cp));
      writeFileSync(`${stem}-diff.png`, PNG.sync.write(diff));
      const status = ratio > threshold ? 'CHANGED' : 'ok';
      rows.push({ label, status, ratio, files: `${slug(target.path)}-${vpName}-{before,after,diff}.png` });
      console.log(`${status === 'CHANGED' ? '✗' : '✓'} ${label} — ${(ratio * 100).toFixed(3)}% diff`);
    }
  }
} finally {
  await browser.close();
}

// ---- summary (console + markdown for CI step summary) ----
const changed = rows.filter((r) => r.status === 'CHANGED');
const skipped = rows.filter((r) => r.status === 'skipped');
let md = `## Visual diff (${scope}) — base vs candidate\n\n`;
md += `Base: ${base || '(per-target)'}\nCandidate: ${candidate || '(per-target)'}\nScope: ${scope}\nThreshold: ${(threshold * 100).toFixed(3)}%\n\n`;
md += `| Target | Status | Diff | Artifacts |\n|---|---|---|---|\n`;
for (const r of rows) {
  const diffCol = r.ratio !== undefined ? `${(r.ratio * 100).toFixed(3)}%` : (r.detail || '');
  md += `| ${r.label} | ${r.status} | ${diffCol} | ${r.files || ''} |\n`;
}
md += `\nImages in \`${outDir}/\`.\n`;
writeFileSync(join(outDir, 'summary.md'), md);

console.log(`\n${rows.length} comparison(s): ${changed.length} changed, ${skipped.length} skipped.`);
console.log(`Images + summary in ${outDir}/`);
if (changed.length && !reportOnly) process.exit(1);
process.exit(0);
