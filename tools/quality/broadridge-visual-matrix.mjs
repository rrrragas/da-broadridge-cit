#!/usr/bin/env node
/**
 * broadridge-visual-matrix — emits the CI matrix for broadridge-visual.yaml from the config's `checks`
 * toggles. The matrix is the cross-product of enabled sources (regression|parity) × scopes (fullpage|block).
 * Prints `matrix=<json>` and `any=<bool>` for $GITHUB_OUTPUT. Disabled combos simply don't appear as checks.
 *
 * Local CLI runs do NOT use this — explicit --scope/--mode always run regardless of these toggles.
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

const cfgPath = process.argv[2] || 'tools/quality/broadridge-visual.config.json';
let checks = {};
try { checks = JSON.parse(readFileSync(cfgPath, 'utf8')).checks || {}; } catch { /* defaults below */ }

const on = (k) => (checks[k] === undefined ? true : Boolean(checks[k])); // default on if unset
const modes = ['regression', 'parity'].filter(on);
const scopes = ['fullpage', 'block'].filter(on);

const include = [];
for (const mode of modes) for (const scope of scopes) include.push({ mode, scope });
const any = include.length > 0;

// When empty, emit a valid (but unused) single entry — the job is gated by `any` in the workflow.
const matrix = { include: any ? include : [{ mode: 'regression', scope: 'fullpage' }] };
process.stdout.write(`matrix=${JSON.stringify(matrix)}\n`);
process.stdout.write(`any=${any}\n`);
