#!/usr/bin/env node
/**
 * broadridge-visual-parse-pr — turn the "Visual comparison URLs" block in a PR description into a
 * manifest for broadridge-visual-check.mjs. See docs/broadridge-VISUAL-TESTING.md.
 *
 * Reads the PR body from env PR_BODY (or --file <path>). Each page is one line, optionally between
 * `<!-- visual:start -->` / `<!-- visual:end -->` markers:
 *
 *   cit-hero | after=https://branch--…aem.page/cit/hero | before=https://main--…aem.live/cit/hero | live=https://legacy…/hero.html
 *
 * --mode regression → { path:name, base:before, candidate:after }  (lines with both before+after)
 * --mode parity     → { path:name, base:live,   candidate:after }  (lines with both live+after)
 *
 * Emits a JSON array to stdout (or --out <file>). Empty array if nothing matches.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const mode = opt('mode', 'regression');
const outFile = opt('out');
const file = opt('file');

const body = file ? readFileSync(file, 'utf8') : (process.env.PR_BODY || '');

// Prefer the marked block; fall back to any line that has an `after=` field.
let lines;
const m = body.match(/<!--\s*visual:start\s*-->([\s\S]*?)<!--\s*visual:end\s*-->/i);
if (m) lines = m[1].split(/\r?\n/);
else lines = body.split(/\r?\n/).filter((l) => /(^|\|)\s*after\s*=/i.test(l));

const slugFrom = (url) => {
  try { return new URL(url).pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root'; } catch { return 'page'; }
};

const entries = [];
for (const raw of lines) {
  const line = raw.replace(/^\s*[-*]\s*/, '').trim(); // strip list bullet
  if (!line || !/after\s*=/i.test(line)) continue;
  const segs = line.split('|').map((s) => s.trim()).filter(Boolean);
  const fields = {};
  let name = '';
  for (const seg of segs) {
    const eq = seg.indexOf('=');
    if (eq === -1) { if (!name) name = seg; continue; } // a bare segment is the page name
    fields[seg.slice(0, eq).trim().toLowerCase()] = seg.slice(eq + 1).trim();
  }
  const after = fields.after;
  const beforeUrl = mode === 'parity' ? fields.live : fields.before;
  if (!after || !beforeUrl) continue; // this line can't feed this mode
  const entry = { path: name || slugFrom(after), base: beforeUrl, candidate: after };
  // block-scope hints (ignored by the fullpage scope): block name → `.class`, or raw selectors.
  if (fields.block) entry.block = fields.block;
  if (fields.selector) entry.selector = fields.selector;
  if (fields['base-selector']) entry.baseSelector = fields['base-selector'];
  entries.push(entry);
}

const json = JSON.stringify(entries, null, 2);
if (outFile) writeFileSync(outFile, json);
else process.stdout.write(`${json}\n`);
process.stderr.write(`parsed ${entries.length} ${mode} target(s) from PR body\n`);
