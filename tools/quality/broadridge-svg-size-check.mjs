#!/usr/bin/env node
/**
 * svg-size-check — committed-asset budget for SVGs (docs/broadridge-EDS-RULES.md §5).
 * Warns at >8KB, fails the build at >40KB. Scans served/committed source dirs only
 * (skips node_modules, git internals, and the skill libraries under .claude/.agents).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WARN = 8 * 1024;
const FAIL = 40 * 1024;
const IGNORE = new Set([
  'node_modules', '.git', '.hlx', 'coverage', 'logs',
  '.claude', '.agents', 'migration-planning', 'drafts',
]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.toLowerCase().endsWith('.svg')) out.push(p);
  }
  return out;
}

const files = walk('.');
let failed = 0;
let warned = 0;
for (const f of files) {
  const kb = statSync(f).size / 1024;
  if (kb * 1024 > FAIL) { console.error(`✘ ${f} — ${kb.toFixed(1)}KB (>40KB, fail — convert to 2× PNG)`); failed += 1; }
  else if (kb * 1024 > WARN) { console.warn(`⚠ ${f} — ${kb.toFixed(1)}KB (>8KB — consider a 2× PNG)`); warned += 1; }
}

if (failed) {
  console.error(`\n✘ svg-size-check: ${failed} oversized SVG(s). See docs/broadridge-EDS-RULES.md §5.\n`);
  process.exit(1);
}
console.log(`✓ svg-size-check: ${files.length} SVG(s) scanned, ${warned} warning(s), 0 over 40KB`);
