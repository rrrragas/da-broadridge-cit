#!/usr/bin/env node
/**
 * redirect-map-check — validates a git-tracked redirect map used during migration
 * (docs/broadridge-MIGRATION-RUNBOOK.md). Source of truth for live redirects is the DA `redirects`
 * sheet (published to /redirects.json); this optional CSV mirror lets us review + CI-validate
 * the map in git. Columns: Source,Destination (header required, case-insensitive).
 *
 * Rules: two non-empty columns; Source is an absolute path (starts with /); Destination is an
 * absolute path or http(s) URL; no self-redirects; no duplicate Sources. Absent file → pass.
 */
import { readFileSync, existsSync } from 'node:fs';

const FILE = 'redirects.csv';
if (!existsSync(FILE)) {
  console.log('✓ redirect-map-check: no redirects.csv (live redirects live in the DA "redirects" sheet) — skipped');
  process.exit(0);
}

const rows = readFileSync(FILE, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
const violations = [];
const seen = new Map();

const header = (rows.shift() || '').split(',').map((c) => c.trim().toLowerCase());
if (header[0] !== 'source' || header[1] !== 'destination') {
  violations.push(`line 1: header must be "Source,Destination" (got "${header.join(',')}")`);
}

rows.forEach((row, i) => {
  const line = i + 2;
  const cols = row.split(',').map((c) => c.trim());
  const [src, dest] = cols;
  if (cols.length < 2 || !src || !dest) { violations.push(`line ${line}: needs two non-empty columns`); return; }
  if (!src.startsWith('/')) violations.push(`line ${line}: Source "${src}" must be an absolute path (start with /)`);
  if (!/^(\/|https?:\/\/)/.test(dest)) violations.push(`line ${line}: Destination "${dest}" must be an absolute path or http(s) URL`);
  if (src === dest) violations.push(`line ${line}: self-redirect (${src})`);
  if (seen.has(src)) violations.push(`line ${line}: duplicate Source "${src}" (first at line ${seen.get(src)})`);
  else seen.set(src, line);
});

if (violations.length) {
  console.error(`✘ redirect-map-check: ${violations.length} issue(s) in ${FILE}`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nSee docs/broadridge-MIGRATION-RUNBOOK.md.\n');
  process.exit(1);
}
console.log(`✓ redirect-map-check: ${seen.size} redirect(s) valid`);
