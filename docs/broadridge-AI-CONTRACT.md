# AI Contract — rules for AI coding tools on Broadridge CIT

This project uses AI coding agents. The same [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md) bind humans and AI, plus the
extra guardrails below. AI tools should read this and [AGENTS.md](../AGENTS.md) at the start of every task.

## Hard constraints (never do)
- **Never modify `scripts/aem.js`** — it is vendored. Put shared code in `scripts/scripts.js` or
  `scripts/broadridge-utils.js`.
- **Never add a runtime dependency** or a build step. EDS ships source as-is; imports are native ESM with
  `.js` extensions. (Dev-only tooling deps like vitest are fine when the lockfile is updated in the same change.)
- **Never introduce** `eval`, `new Function`, `document.write`, or `javascript:`/`vbscript:` URLs
  (`broadridge:check:security` fails the build on these).
- **Never add third-party scripts to `head.html`.** Integrations load in the delayed phase.
- **Never weaken the CSP** in `head.html` (see [broadridge-SECURITY-HEADERS.md](broadridge-SECURITY-HEADERS.md)) to make code work —
  fix the code instead.
- **Never commit secrets.** Server-side secrets go through edge workers/middleware.

## Required workflow (always do)
- Before proposing a PR, run and pass: `npm run lint`, `npm run broadridge:check`, `npm run broadridge:test:unit`, and
  `npm run broadridge:test:a11y` on affected pages. Report the actual results — don't claim green without running.
- For any block change, run the `broadridge-block-review` skill; for the PR, run `broadridge-pr-readiness`.
- Provide **before/after branch-preview links** and screenshots in the PR (the template requires them).
- When you change a block's authored structure, update [broadridge-BLOCKS.md](broadridge-BLOCKS.md) in the same change.
- Ground assumptions in the actual code before writing — verify a helper exists (e.g. this repo's `aem.js`
  has no `fetchPlaceholders`) rather than assuming boilerplate defaults.

## Judgement calls
- **Reuse before rewrite, but don't preserve bad code.** If existing code is small and broken, rewriting it
  cleanly is acceptable — EDS blocks are meant to be lightweight and disposable. Say so in the PR.
- **Content-first.** Favour the simplest authoring model; don't add config fields authors won't use.
- **Honesty over green.** If Lighthouse can't hit 100 because of required MarTech, say so and note the
  tradeoff — don't hide it or game the metric.
- **Ask when scope is ambiguous.** Prefer one clarifying question over a large speculative change.

## When these rules and a request conflict
The rules win. If a user request requires breaking a hard constraint, stop and explain the conflict rather
than silently working around it (e.g. disabling a check, editing `aem.js`, or loosening the CSP).
