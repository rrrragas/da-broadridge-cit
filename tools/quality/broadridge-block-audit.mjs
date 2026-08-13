#!/usr/bin/env node
/**
 * broadridge-block-audit — thin orchestrator (RETIRED hand-spec engine).
 *
 * This used to hold a hand-written capture spec per block. It has been replaced
 * by the GENERIC, content-anchored engine in broadridge-visual-compare.mjs, which
 * covers every block with zero per-block code and is a superset of the old checks
 * (style drift, WCAG contrast, alignment, layout composition, section transitions,
 * hover state) PLUS content-completeness (missing/added nodes) and a cross-viewport
 * pivot. See docs/broadridge-VISUAL-TESTING.md.
 *
 * The `broadridge:audit:blocks` script name is kept so CI/docs don't break: it now
 * drives broadridge-visual-compare.mjs across every block target in
 * tools/quality/broadridge-visual.config.json (parity mode, block scope), writing
 * one report per block.
 *
 * Usage:
 *   npm run broadridge:audit:blocks            # all config block targets
 *   node tools/quality/broadridge-block-audit.mjs --block footer   # one target
 * Any extra flags (--viewport, --strict, --base, --candidate) pass through.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}

const ROOT = process.cwd();
let config = {};
try { config = JSON.parse(readFileSync(join(ROOT, 'tools/quality/broadridge-visual.config.json'), 'utf8')); } catch { /* optional */ }

const targets = Array.isArray(config.targets) ? config.targets : [];
if (!targets.length) {
  console.error('No block targets in broadridge-visual.config.json.');
  process.exit(0);
}

// derive a readable block name from a target's EDS selector (.hero-banner → hero-banner)
const blockName = (t) => (t.block || (t.edsSelector || t.selector || '').replace(/^\./, '').split(/[ .>]/)[0] || 'block');
const only = arg('block');
const selected = only ? targets.filter((t) => blockName(t) === only) : targets;
if (!selected.length) {
  console.error(`No target named "${only}". Known: ${targets.map(blockName).join(', ')}`);
  process.exit(1);
}

// flags to forward to the generic comparator (everything except our --block filter)
const passthrough = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '--block') { i += 1; continue; }
  passthrough.push(a);
}

console.log(`Block audit → generic comparator across ${selected.length} target(s): ${selected.map(blockName).join(', ')}\n`);
let failed = 0;
for (const t of selected) {
  const name = blockName(t);
  const src = t.liveSelector || t.baseSelector || t.edsSelector;
  const dst = t.edsSelector || t.selector || (t.block ? `.${t.block}` : null);
  const path = t.livePath || t.edsPath || t.path || '/cit';
  if (!src || !dst) { console.warn(`⚠ ${name} — skipped (needs edsSelector + liveSelector in config)`); continue; }
  console.log(`\n=== ${name} (${src} → ${dst}) ===`);
  try {
    execFileSync('node', [
      'tools/quality/broadridge-visual-compare.mjs',
      '--source-selector', src,
      '--dest-selector', dst,
      '--path', path,
      '--out', join('tools/quality/visual-output', `audit-${name}.md`),
      ...passthrough,
    ], { stdio: 'inherit' });
  } catch {
    failed += 1;
    console.warn(`(${name} exited non-zero)`);
  }
}
console.log(`\nDone. Per-block reports in tools/quality/visual-output/audit-*.md.`);
process.exit(failed && passthrough.includes('--strict') ? 1 : 0);
