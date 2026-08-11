#!/usr/bin/env node
/**
 * color-token-check — ADVISORY (never fails the build). Flags raw hex colors in blocks/*.css
 * so they can move to design tokens in styles/styles.css (docs/broadridge-EDS-RULES.md §2).
 * Advisory on purpose: this repo's boilerplate defines tokens in styles.css and does not yet
 * tokenize every block, so blocking here would break lint on day one.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

const files = walk('blocks');
const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const code = ln.split('/*')[0]; // ignore trailing comments
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hex) hits.push(`${f}:${i + 1}  ${hex.join(', ')}  →  ${ln.trim()}`);
  });
}

if (hits.length) {
  console.warn(`\n⚠ color-token-check (advisory): ${hits.length} raw color(s) in blocks/ — prefer var(--token) from styles/styles.css`);
  for (const h of hits) console.warn(`  ${h}`);
  console.warn('\nAdvisory only — does not fail the build. See docs/broadridge-EDS-RULES.md §2.\n');
} else {
  console.log('✓ color-token-check: no raw hex colors in blocks/');
}
process.exit(0);
