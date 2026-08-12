#!/usr/bin/env node
/**
 * breakpoint-check — enforces the project CSS breakpoint rule (docs/broadridge-EDS-RULES.md §2):
 * mobile-first, min-width semantics only, breakpoints at 600 / 900 / 1200.
 *
 * Only inspects @media *conditions* (so a `max-width:` CSS property on an element is not flagged).
 * Accepts both classic `min-width: 900px` and modern range `@media (width >= 900px)`.
 * Exits non-zero on any violation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set([600, 900, 1200]);
const ROOTS = ['blocks', 'styles'];

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

const lineOf = (content, index) => content.slice(0, index).split('\n').length;

const files = ROOTS.flatMap((r) => walk(r));
const violations = [];

for (const file of files) {
  const css = readFileSync(file, 'utf8');
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const prelude = m[1];
    const line = lineOf(css, m.index);
    const tokens = [];

    for (const c of prelude.matchAll(/(min|max)-(?:device-)?width\s*:\s*(\d+)px/gi)) {
      tokens.push({ kind: c[1].toLowerCase() === 'min' ? 'min' : 'max', px: +c[2] });
    }
    for (const r of prelude.matchAll(/width\s*(<=|>=|<|>)\s*(\d+)px/gi)) {
      tokens.push({ kind: (r[1] === '>=' || r[1] === '>') ? 'min' : 'max', px: +r[2] });
    }
    for (const r of prelude.matchAll(/(\d+)px\s*(<=|>=|<|>)\s*width/gi)) {
      // `600px <= width` means width >= 600 (min); `600px >= width` means max
      tokens.push({ kind: (r[2] === '<=' || r[2] === '<') ? 'min' : 'max', px: +r[1] });
    }
    if (!tokens.length) continue;

    const q = `@media${prelude.trim()}`;
    const hasMin = tokens.some((t) => t.kind === 'min');
    const hasMax = tokens.some((t) => t.kind === 'max');

    if (hasMin && hasMax) {
      violations.push(`${file}:${line}  mixes min- and max-width in one query — ${q}`);
    } else if (hasMax) {
      violations.push(`${file}:${line}  uses max-width semantics — use mobile-first min-width — ${q}`);
    }
    for (const t of tokens) {
      if (t.kind === 'min' && !ALLOWED.has(t.px)) {
        violations.push(`${file}:${line}  non-standard breakpoint ${t.px}px (allowed: 600/900/1200) — ${q}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`\n✘ breakpoint-check: ${violations.length} issue(s)\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nRule: mobile-first, min-width only, breakpoints 600/900/1200. See docs/broadridge-EDS-RULES.md §2.\n');
  process.exit(1);
}
console.log(`✓ breakpoint-check: ${files.length} file(s) OK — all media queries mobile-first at 600/900/1200`);
