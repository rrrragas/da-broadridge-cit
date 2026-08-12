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

const base = arg('base');
const candidate = arg('candidate');
const manifestPath = arg('manifest', 'tools/quality/broadridge-visual-targets.json');
const outDir = arg('out', 'tools/quality/visual-output');
const threshold = parseFloat(arg('threshold', '0.001'));
const onlyPath = arg('path');
const reportOnly = hasFlag('report-only');

if (!base || !candidate) {
  console.error('Usage: --base <url> --candidate <url> [--manifest --out --threshold --path --report-only]');
  process.exit(1);
}

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

/** Screenshot url at a viewport → { ok, buffer } (ok:false on non-200 or nav error). */
async function shoot(browser, url, vp) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(vp);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || resp.status() >= 400) return { ok: false, reason: `HTTP ${resp ? resp.status() : 'no-response'}` };
    await page.waitForTimeout(1500); // settle animations/fonts
    const buffer = await page.screenshot({ fullPage: true });
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
    const vps = (target.viewports && target.viewports.length ? target.viewports : Object.keys(VIEWPORTS));
    for (const vpName of vps) {
      const vp = VIEWPORTS[vpName];
      if (!vp) { console.warn(`skip unknown viewport "${vpName}"`); continue; }
      const label = `${target.path} @ ${vpName}`;
      // Per-target full-URL overrides support migration parity, where the legacy/source page lives
      // at a different path/origin than the new EDS page — e.g.
      //   { "path": "/cit/hero", "base": "https://legacy.example.com/investor/hero.html" }
      // compares the legacy hero against <candidate>/cit/hero. Falls back to <origin> + path.
      const baseUrl = target.base || (stripTrailing(base) + target.path);
      const candUrl = target.candidate || (stripTrailing(candidate) + target.path);
      const [b, c] = await Promise.all([
        shoot(browser, baseUrl, vp),
        shoot(browser, candUrl, vp),
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
let md = `## Visual regression — base vs candidate\n\n`;
md += `Base: ${base}\nCandidate: ${candidate}\nThreshold: ${(threshold * 100).toFixed(3)}%\n\n`;
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
