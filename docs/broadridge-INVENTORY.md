# Broadridge CIT — Governance System Inventory

A reference for everything added to this repo to make EDS/UI best practices enforceable for developers **and**
AI tools. Everything we created is prefixed `broadridge-` (files) or `broadridge:` (npm scripts) to distinguish
it from the stock aem-boilerplate and the 24 stock Adobe skills.

## Mental model — four ways things load

Understanding *how* each artifact loads is half the picture:

- **Push (always-on):** injected into every AI session's context automatically at session start. → `CLAUDE.md` → `AGENTS.md`.
- **Trigger-loaded:** only a one-line description is registered; the full body loads when invoked. → skills.
- **Pull (on-demand):** sits in the repo; read only when someone/something opens it. → `docs/*.md`.
- **Execute:** runs when a command/event fires. → checkers, tests, CI, hooks.

The same rule often lives at several layers on purpose (e.g. breakpoints are in AGENTS.md, detailed in
EDS-RULES, checklisted in a skill, **and** enforced by a script on every edit + push). The earlier a
violation is caught, the cheaper it is.

## Command cheat-sheet

```bash
npm run lint                   # stock: ESLint + Stylelint (unchanged)
npm run broadridge:check       # all 5 checkers: breakpoints, svg, colors, security, redirects
npm run broadridge:test:unit   # vitest unit tests
npm run broadridge:test:a11y   # axe-core WCAG audit (needs playwright; see note)
npm run broadridge:test:visual -- --base <prod> --candidate <branch|localhost>   # visual diff
# individual: broadridge:check:breakpoints | :svg | :colors | :security | :redirects
```

---

## 1. Always-on rules (push-loaded into AI context)

| File | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `AGENTS.md` *(modified)* | Project constitution for humans + AI. We added a **Best Practices & Guardrails** section, a docs index, and an AI-contract pointer. Example: an AI about to write a media query sees "600/900/1200, min-width only" without opening any other file. | **Claude Code harness, at session start.** `CLAUDE.md` contains `see @AGENTS.md`, so both are pulled into the system context every session. Always present. |

## 2. Project docs (pull-loaded, on demand)

Not auto-loaded — referenced from `AGENTS.md`/skills and opened when relevant (a human clicks; an AI runs `Read`).

| File (new) | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `docs/broadridge-EDS-RULES.md` | Full ruleset; every rule tagged `[enforced-by: …]` or `[review-only]`. Example: unsure about RTL → open §7. | Pull. Linked from AGENTS.md and every skill. |
| `docs/broadridge-BLOCKS.md` | Block catalog — each block's authored structure/variants/metadata/dev-notes. Example: before editing `hero`, read "hero.js empty, CSS-only." | Pull. Referenced by `broadridge-block-review`. |
| `docs/broadridge-SECURITY-HEADERS.md` | Documents the existing CSP in `head.html` + how to extend it narrowly. | Pull. Linked from EDS-RULES §4 and security-check output. |
| `docs/broadridge-SEO-METADATA.md` | Metadata schema, canonical, hreflang, JSON-LD. | Pull. Used during authoring/migration. |
| `docs/broadridge-MIGRATION-RUNBOOK.md` | 6-phase migration process + rollback. | Pull. Used by whoever runs the migration. |
| `docs/broadridge-AI-CONTRACT.md` | Hard constraints + required workflow for AI tools. | Pull, but **pointed at from AGENTS.md**, so an AI is directed to `Read` it at task start. |
| `docs/broadridge-VISUAL-TESTING.md` | Visual-regression model, config, workflows, reading diffs. | Pull. Linked from the block-review skill + visual CI. |
| `docs/broadridge-VISUAL-ONBOARDING.md` | Junior-dev walkthrough: how to invoke, inputs, step-by-step, output (local + CI). | Pull. New-dev onboarding. |
| `docs/broadridge-INVENTORY.md` | This document. | Pull. |

## 3. Skills (trigger-loaded)

| File (new) | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `.claude/skills/broadridge-block-review/SKILL.md` | Pre-PR block self-review checklist. | **The Skill tool.** At session start the harness registers only `name`+`description`; the **full body loads when invoked** — description match ("modified an EDS block"), a user typing `/broadridge-block-review`, or the model choosing it. |
| `.claude/skills/broadridge-pr-readiness/SKILL.md` | Definition of done before a PR. | Same. Loads when preparing a PR. |
| `.claude/skills/broadridge-i18n-rtl/SKILL.md` | Placeholders/`Intl`/RTL guidance. | Same. Loads when code touches user-facing text or locales. |
| `.claude/skills/broadridge-visual/SKILL.md` | Run visual comparison — full-page or block, regression or parity — locally (`broadridge:visual:all` or per-combo). | Same. Loads when doing a visual check. |
| `.agents/skills/broadridge-*/SKILL.md` (3 mirrors) | Byte-identical copies. | Read by **other agent tooling that consumes `.agents/`** (the repo already maintained this twin tree). Kept in sync. |

## 4. Harness & tooling config

| File | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `.claude/settings.json` *(new)* | (a) `permissions.allow` auto-approves safe commands (`npm run lint`, `broadridge:check`, `node tools/quality/*`, git reads). (b) `hooks.PostToolUse` runs `broadridge-breakpoint-check.mjs` after every edit so the AI self-corrects a bad breakpoint immediately. | **Claude Code harness.** Read at **session start**; permissions consulted per tool call; the hook fires **after every `Edit`/`Write`/`MultiEdit`**. ⚠️ A settings file written mid-session applies to **new sessions**, not retroactively. |
| `.eslintignore` *(modified)* | Excludes `tools/`, `test/`, `vitest.config.mjs` from linting (Node tooling, not shipped browser code). | **ESLint**, when `eslint .` runs (inside `npm run lint`). |
| `vitest.config.mjs` *(new)* | Points vitest at `test/**` + `blocks/**`, Node environment. | **Vitest**, when `vitest run` executes. |
| `package.json` *(modified)* | Adds `broadridge:*` scripts + `vitest` devDep. Example: `npm run broadridge:check` chains all 5 checkers. | **npm**, when a dev/CI/hook runs a script. |
| `package-lock.json` *(modified)* | Pins vitest + transitive deps so `npm ci` is reproducible. | **npm**, during `npm ci`/`install`. |

## 5. Executable checkers, tests, runtime util

| File (new) | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `tools/quality/broadridge-breakpoint-check.mjs` | **Fails** on non-600/900/1200 or `max-width` media queries. Accepts range + `min-width` syntax; inspects only `@media` conditions. | `npm run broadridge:check:breakpoints` — run by **dev, the CI push build, and the settings.json edit-hook**. |
| `tools/quality/broadridge-svg-size-check.mjs` | Warns >8KB, **fails** >40KB committed SVGs. | `broadridge:check:svg` → dev + CI. |
| `tools/quality/broadridge-color-token-check.mjs` | **Advisory** — warns on raw hex in `blocks/` (never fails). | `broadridge:check:colors` → dev + CI. |
| `tools/quality/broadridge-security-check.mjs` | **Fails** on `eval`/`new Function`/`document.write`/`javascript:` URLs; **warns** on `innerHTML`. | `broadridge:check:security` → dev + CI. |
| `tools/quality/broadridge-redirect-map-check.mjs` | Validates `redirects.csv` format (skips if absent). | `broadridge:check:redirects` → dev + CI. |
| `tools/quality/broadridge-a11y-check.mjs` | axe-core WCAG 2.1 A/AA audit of URLs. | `broadridge:test:a11y` → **dev locally + the `broadridge-a11y.yaml` PR workflow**. |
| `tools/quality/broadridge-visual-check.mjs` | Playwright + pixelmatch visual diff (mobile/tablet/desktop); writes before/after/diff PNGs. Reads pages from `config.targets`; skips 404 targets. | `broadridge:test:visual` → **dev locally + the visual matrix PR workflow**. |
| `tools/quality/broadridge-visual-parse-pr.mjs` | Parses the `visual:start` block in a PR description into a per-mode manifest (regression uses `before=`, parity uses `live=`). | Run inside the visual workflows. |
| `tools/quality/broadridge-visual.config.json` | **Single config**: origins (regressionBase/parityBase/localCandidate), defaults (threshold/viewports), `checks` CI toggles, and the `targets` array (per-page paths + block selectors). | Read by `broadridge-visual-check.mjs` + `broadridge-visual-matrix.mjs`. |
| `tools/quality/broadridge-visual-matrix.mjs` | Builds the CI matrix from `config.checks` (enabled sources × scopes); disabled combos don't run. | Run by the `setup` job in `broadridge-visual.yaml`. |
| `test/broadridge-utils.test.js` | 7 unit tests for `isSafeUrl`/`formatCurrency`. | **Vitest**, via `broadridge:test:unit` → dev + CI push build. |
| `scripts/broadridge-utils.js` | Runtime helpers (`isSafeUrl`, `formatCurrency`) for blocks. Example: `import { isSafeUrl } from '../../scripts/broadridge-utils.js'`. | **The browser**, at page load, when a block that imports it runs. No block imports it yet — it's a provided, tested helper. |

## 6. CI/CD & GitHub

| File | Purpose & how it works (example) | Loaded/triggered by — when |
|---|---|---|
| `.github/workflows/main.yaml` *(modified)* | Runs `npm ci` → `lint` → `broadridge:check` → `broadridge:test:unit`. | **GitHub Actions, on every `push`** (`on: [push]`). |
| `.github/workflows/broadridge-a11y.yaml` *(new)* | Waits for the branch preview, runs axe-core against it. | **GitHub Actions, on `pull_request` to `main`**. |
| `.github/workflows/broadridge-visual.yaml` *(new)* | 2×2 matrix → 4 checks: `(regression\|parity) × (fullpage\|block)`, driven by PR `before=`/`live=`/`after=`/`block=` URLs. Artifacts `visual-<mode>-<scope>-diff`. Report-only. | **GitHub Actions, on `pull_request` touching `blocks/** scripts/** styles/** head.html`** + manual. |
| `.github/pull_request_template.md` *(modified)* | Pre-fills the PR body with the definition-of-done checklist. | **GitHub**, when a contributor **opens a PR**. |

---

## Modified existing files (couldn't be renamed — additions only)

These are stock files we edited; the *distinction* is our added content, not the filename:

- `AGENTS.md` — added the guardrails section + docs index.
- `package.json` — added `broadridge:*` scripts + `vitest` devDep (stock `lint*` untouched).
- `package-lock.json` — vitest deps pinned.
- `.github/workflows/main.yaml` — added `broadridge:check` + `broadridge:test:unit` steps.
- `.github/pull_request_template.md` — appended the DoD checklist.
- `.eslintignore` — added `tools/`, `test/`, `vitest.config.mjs`.

## What could not be `broadridge-` prefixed (and why)

- `.claude/settings.json` — fixed filename the Claude Code harness reads.
- `vitest.config.mjs` — vitest auto-discovers `vitest.config.*`; a prefix would break discovery without extra config.
- Folders `docs/`, `tools/`, `test/` — new folders (they already signal "ours"); files within them are prefixed.
- `redirects.csv` (referenced, not created) — an EDS/DA convention name, not ours to rename.

## Verification status (at time of writing)

- `npm run lint` ✅ · `npm run broadridge:test:unit` → 7/7 ✅ · `npm run broadridge:check` → 5/5 ✅ · JSON parses ✅
- Enforcing checkers confirmed to **fail** on planted violations; advisories (color, innerHTML) **warn** without failing.
- Internal doc links resolve (the PR template's `../issues` is an intentional GitHub-relative link, valid on GitHub).
- `.claude` ↔ `.agents` skill mirrors are byte-identical.

## Decisions

**Resolved:**
- Slack/author attributions removed from `broadridge-EDS-RULES.md`; provenance kept as generic "internal engineering guidance."
- a11y CI gate is **report-only for sprint one** (`continue-on-error` in `broadridge-a11y.yaml`); flip to blocking once the baseline is clean.

**Still open:**
1. Multi-brand: how many brands share this codebase (affects "test against each brand" rules).
2. `npm audit` reports pre-existing vulnerabilities in boilerplate dev deps — separate decision, not addressed here.

## Note on `broadridge:test:a11y` locally

It "fails" locally only because playwright/@axe-core aren't saved deps (deliberate — keeps the lockfile clean and
the Build workflow's `npm ci` fast). To run it locally:

```bash
npm i -D playwright @axe-core/playwright && npx playwright install chromium
```

CI installs these ad hoc in `broadridge-a11y.yaml`.
