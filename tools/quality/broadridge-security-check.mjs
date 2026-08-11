#!/usr/bin/env node
/**
 * security-check — client-code safety scan (docs/broadridge-EDS-RULES.md §4, docs/broadridge-SECURITY-HEADERS.md).
 *
 * FAILS the build on genuinely dangerous, absent-today patterns:
 *   eval(), new Function(), document.write(), and javascript:/vbscript: URL literals.
 * WARNS (advisory) on innerHTML/outerHTML/insertAdjacentHTML, which the boilerplate blocks
 *   (widget, fragment, header) legitimately use — prefer createElement/textContent for new code.
 *
 * Scans blocks/**\/*.js and scripts/*.js, excluding scripts/aem.js (vendored, never modified).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FAIL_PATTERNS = [
  { re: /\beval\s*\(/g, msg: 'eval() is forbidden' },
  { re: /\bnew\s+Function\s*\(/g, msg: 'new Function() is forbidden' },
  { re: /\bdocument\s*\.\s*write(ln)?\s*\(/g, msg: 'document.write() is forbidden' },
  { re: /["'`]\s*(javascript|vbscript)\s*:/gi, msg: 'javascript:/vbscript: URL literal' },
];
const WARN_PATTERNS = [
  { re: /\.\s*(inner|outer)HTML\s*=/g, msg: 'innerHTML/outerHTML assignment — prefer createElement/textContent' },
  { re: /insertAdjacentHTML\s*\(/g, msg: 'insertAdjacentHTML — prefer createElement/textContent' },
];

function jsFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const targets = [
  ...jsFiles('blocks'),
  ...['scripts/scripts.js', 'scripts/broadridge-utils.js', 'scripts/consent-check.js', 'scripts/consented.js', 'scripts/delayed.js']
    .filter((f) => { try { return statSync(f).isFile(); } catch { return false; } }),
];

const lineOf = (content, index) => content.slice(0, index).split('\n').length;

/**
 * Blank out comments so we don't flag patterns that only appear in documentation
 * (e.g. a JSDoc line that says "blocks javascript: URLs"). Newlines are preserved so
 * reported line numbers stay accurate. `//` preceded by `:` is left alone so URLs like
 * `https://` inside strings are not mistaken for line comments.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

const fails = [];
const warns = [];

for (const file of targets) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const { re, msg } of FAIL_PATTERNS) {
    for (const m of code.matchAll(re)) fails.push(`${file}:${lineOf(code, m.index)}  ${msg}`);
  }
  for (const { re, msg } of WARN_PATTERNS) {
    for (const m of code.matchAll(re)) warns.push(`${file}:${lineOf(code, m.index)}  ${msg}`);
  }
}

if (warns.length) {
  console.warn(`⚠ security-check (advisory): ${warns.length} finding(s)`);
  for (const w of warns) console.warn(`  ${w}`);
  console.warn('');
}
if (fails.length) {
  console.error(`✘ security-check: ${fails.length} forbidden pattern(s)`);
  for (const f of fails) console.error(`  ${f}`);
  console.error('\nSee docs/broadridge-EDS-RULES.md §4. If a use is genuinely required, justify it in review.\n');
  process.exit(1);
}
console.log(`✓ security-check: ${targets.length} file(s), no forbidden patterns (${warns.length} advisory)`);
