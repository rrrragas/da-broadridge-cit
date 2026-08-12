#!/usr/bin/env node
/**
 * broadridge-visual-all — run every enabled visual combo locally in one shot: the cross-product of
 * enabled sources (regression|parity) × scopes (fullpage|block) from config.checks, over config.targets.
 * The local equivalent of the CI matrix. See docs/broadridge-VISUAL-TESTING.md.
 *
 * Usage: npm run broadridge:visual:all [-- <extra args passed to each run, e.g. --candidate <url> --path /cit>]
 * Report-only: prints each combo's summary; never fails. Output per combo in tools/quality/visual-output/<mode>-<scope>/.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

let checks = {};
try { checks = JSON.parse(readFileSync('tools/quality/broadridge-visual.config.json', 'utf8')).checks || {}; } catch { /* default all on */ }
const on = (k) => (checks[k] === undefined ? true : Boolean(checks[k]));
const modes = ['regression', 'parity'].filter(on);
const scopes = ['fullpage', 'block'].filter(on);
const passthrough = process.argv.slice(2);

if (!modes.length || !scopes.length) {
  console.log('Nothing enabled in config.checks (need ≥1 source and ≥1 scope).');
  process.exit(0);
}

console.log(`Running ${modes.length * scopes.length} combo(s): [${modes.join(', ')}] × [${scopes.join(', ')}]\n`);
for (const mode of modes) {
  for (const scope of scopes) {
    console.log(`\n=== ${mode} / ${scope} ===`);
    try {
      execFileSync('node', [
        'tools/quality/broadridge-visual-check.mjs',
        '--mode', mode,
        '--scope', scope,
        '--out', `tools/quality/visual-output/${mode}-${scope}`,
        '--report-only',
        ...passthrough,
      ], { stdio: 'inherit' });
    } catch {
      console.warn(`(${mode}/${scope} exited non-zero)`);
    }
  }
}
console.log('\nDone. Diff images per combo in tools/quality/visual-output/<mode>-<scope>/.');
