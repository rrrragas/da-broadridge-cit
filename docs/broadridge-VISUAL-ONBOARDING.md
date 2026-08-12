# Visual Checks — Onboarding Walkthrough

A first-day guide to the visual comparison checks: how to run them, what to give them, what they do step by
step, and what you get back. Reference: [broadridge-VISUAL-TESTING.md](broadridge-VISUAL-TESTING.md).

## The idea in one line

Take **two** versions of a page (a *before* and an *after*), screenshot both at three screen sizes, and highlight
the pixels that differ.

Two knobs decide the rest:

- **Source** — what *before* means: **regression** (before = EDS `main`) or **parity** (before = the old/legacy site).
- **Scope** — how much you shoot: **fullpage** (whole page) or **block** (one component, e.g. `.hero-banner`).

That's 2 × 2 = four combinations. You run them one of two ways: **locally** (a command) or **in a PR** (the CI does it).

## Set-up once

```bash
npx playwright install chromium     # the headless browser used for screenshots
```

Project defaults (which URLs, sensitivity, screen sizes) live in
**`tools/quality/broadridge-visual.config.json`** — edit that once instead of typing long commands:

```json
{
  "regressionBase": "https://main--da-broadridge-cit--rrrragas.aem.live",
  "parityBase": "",                       // ← set this to the legacy/source site
  "localCandidate": "http://localhost:3000",
  "threshold": 0.001,
  "viewports": ["mobile", "tablet", "desktop"],
  "checks": { "regression": true, "parity": true, "fullpage": true, "block": true },
  "targets": [
    { "edsPath": "/cit", "livePath": "/cit", "edsSelector": ".hero-banner", "liveSelector": ".et_pb_fullwidth_header" }
  ]
}
```

`targets` is the list of **pages** — one entry per page: `edsPath`/`livePath` (the EDS vs live-site routes) and,
for block scope, `edsSelector`/`liveSelector` (the element on each side). Set `livePath` only if the route
differs. Add pages as they migrate:
`{ "edsPath": "/cit/products", "livePath": "/products", "edsSelector": ".cards", "liveSelector": ".old-cards" }`.

`checks` are **CI on/off toggles** — the PR runs enabled *sources* (regression/parity) × enabled *scopes*
(fullpage/block). Turn `parity` off until migration starts, or `block` off early on. (Local commands ignore these.)

---

## A) Running it locally

### How to invoke
- **With Claude Code:** ask for a skill — "run a block-level visual check of the hero on my branch" → it loads
  the `broadridge-visual` skill and runs the command.
- **Raw command:** run the npm script. Because the config supplies the URLs, you pass only a few flags.

```bash
aem up      # serve your branch at http://localhost:3000 (the "after")

# everything (all enabled combos on every config target) — the usual one:
npm run broadridge:visual:all

# or a single combo:
npm run broadridge:test:visual -- --scope fullpage --path /cit                 # regression, full page
npm run broadridge:test:visual -- --scope block --path /cit                    # regression, hero block
npm run broadridge:test:visual -- --mode parity --scope block --path /cit      # parity, hero block
```

### The inputs (flags)

| Flag | Meaning | Default |
|---|---|---|
| `--scope` | `fullpage` or `block` | `fullpage` |
| `--mode` | `regression` or `parity` (picks the *before* URL from config) | `regression` |
| `--block` | (block scope) EDS block name → `.class` | — |
| `--selector` | (block scope) raw CSS instead of a block name | — |
| `--base-selector` | (parity + block) the legacy element's selector | — |
| `--path` | which page (from the manifest) | all manifest paths |
| `--base` / `--candidate` | override the before/after URLs | from config |
| `--threshold` | override diff sensitivity | from config |
| `--report-only` | never exit non-zero | off |

### What happens, step by step
1. **Loads** Playwright + pixelmatch + pngjs (prints an install hint and stops if missing).
2. **Reads the config** (URLs, threshold, viewports) and the **manifest** (list of pages); `--path` narrows to one.
3. **Launches headless Chrome.**
4. **For each page × each viewport** (mobile 375 / tablet 768 / desktop 1200):
   1. Resolves the two URLs (config base + path, and candidate + path).
   2. **Screenshots both** in parallel: navigate → wait for network idle → wait 1.5 s for fonts/animations → capture.
      In `block` scope it captures **just that element**; in `fullpage` the whole scrolling page.
   3. If a page 404s or the block isn't found → **skips** it with a note (never crashes).
   4. **Pads both images** to the same size and **diffs** them → a changed-pixel **percentage**.
   5. **Writes** PNGs named for each side: `…-eds-main.png`/`…-eds-branch.png`/`…-diff.png` (regression) or
      `…-livesite.png`/`…-eds.png`/`…-diff.png` (parity).
5. **Closes the browser and writes a summary.**

### What you get
- **Images + `summary.md`** in `tools/quality/visual-output/` (git-ignored).
- **Console table**: `page @ viewport → diff % → status`.
- **Exit code** `0`/`1` (`1` if something exceeded the threshold) — unless `--report-only`.

---

## B) Running it in a PR (CI)

### How to invoke
You don't run a command — you **fill in the PR description**. Opening a PR that changes `blocks/`, `scripts/`,
`styles/`, or `head.html` triggers the workflow automatically.

### The input — the PR description block
The PR template already has this; edit the line(s):

```
<!-- visual:start -->
- cit-hero | after=https://<branch>--da-broadridge-cit--rrrragas.aem.page/cit | before=https://main--da-broadridge-cit--rrrragas.aem.live/cit | live=https://www.legacy-cit-site.com/cit | block=hero-banner
<!-- visual:end -->
```

One line per changed page:
- `after=` your branch preview (**required**)
- `before=` EDS main → the **regression** checks
- `live=` the legacy site → the **parity** checks
- `block=` also run **block-level** on that block (omit → full page only)

### What happens, step by step
1. GitHub sees the PR, checks the **path filter** (did you touch block/page code?).
2. The **2×2 matrix fans out into 4 jobs**: `(regression|parity) × (fullpage|block)`.
3. Each job: checkout → `npm ci` → **parse the PR description** for its mode → build a before/after manifest →
   install Chrome → **wait for your branch preview** to go live → run the same tool with its `--scope`.
   (A job with nothing to compare posts "nothing to compare" and stops early. regression+fullpage falls back to
   the default `main` vs branch manifest so it always shows something.)

### What you get
- A **job-summary table** per check on the PR.
- Downloadable **artifacts**: `visual-regression-fullpage-diff`, `visual-regression-block-diff`,
  `visual-parity-fullpage-diff`, `visual-parity-block-diff` (zips of the before/after/diff PNGs).
- **4 checks** on the PR — **report-only** today, so they never block the merge; they're for you and the reviewer.

---

## Reading the result (either way)

| Status | Meaning | Do |
|---|---|---|
| **ok** | diff ≤ threshold (0.1%) | nothing |
| **CHANGED** | diff > threshold | open the `-diff.png`; confirm it's intentional and note it in the PR |
| **skipped** | 404, or block not found on one side | expected mid-migration, or parity-block (supply `base-selector=`) |

> **Regression** % is meaningful and low-noise (EDS vs EDS). **Parity** % is usually high (legacy vs EDS are
> different implementations) — there, the value is the **side-by-side images**, not the number.

## End-to-end example (you added a hero block)
1. Build `blocks/hero-banner/` on branch `142-hero-banner`; `aem up`.
2. Local check: `npm run broadridge:test:visual -- --scope block --block hero-banner --path /cit` → open the diff PNG.
3. Open the PR; fill the `visual:start` line (`after`/`before`/`live`/`block=hero-banner`).
4. CI runs 4 checks; download `visual-parity-block-diff` (your hero vs the legacy hero) and
   `visual-regression-fullpage-diff` (nothing else on `/cit` shifted).
5. Reviewer eyeballs the summaries + artifacts and merges. On `main`, that becomes the new regression baseline.

## Related
- [broadridge-VISUAL-TESTING.md](broadridge-VISUAL-TESTING.md) — the reference (config, workflows, modes).
- Skill: `broadridge-visual`.
- [broadridge-pr-readiness](../.claude/skills/broadridge-pr-readiness/SKILL.md) — the PR definition of done.
