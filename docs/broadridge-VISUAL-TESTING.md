# Visual Regression Testing — Broadridge CIT

Screenshots and diffs pages when block or page code changes, so unintended layout/style regressions are caught
before merge. Runs as a **local pre-check** and a **PR CI job**. Rules: [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md).

## Model

Compare a **BASE (before)** against a **CANDIDATE (after)** for a manifest of page paths, at mobile / tablet /
desktop. Both sides render in the same browser, so there are **no baseline PNGs in git** and no font/AA mismatch.
`--base` / `--candidate` are just URLs — point them at whatever you need:

| Mode | BASE (before) | CANDIDATE (after) | Answers |
|---|---|---|---|
| **Regression** (default) | EDS `main` live — `https://main--da-broadridge-cit--<owner>.aem.live` | branch preview `https://<branch>--…aem.page` (or `http://localhost:3000`) | "did my change break the *current* EDS site?" |
| **Migration parity** | the **legacy/source site** being migrated | the branch preview / localhost | "does my new EDS page match the *original* site?" |

Use **migration parity** when the page is brand-new on EDS (e.g. a hero block that `main` doesn't have yet) —
comparing against `main` would just 404 and skip. Point BASE at the legacy site instead.

> Caveat for migration parity: a legacy non-EDS page and a new EDS page are different implementations, so the
> pixel-diff **%** will usually be high even when they look alike. In this mode treat the **before/after images
> as a side-by-side visual reference**, not a pass/fail threshold — which is another reason it stays report-only.

### Config — set the defaults once

Project defaults live in `tools/quality/broadridge-visual.config.json`, so you rarely pass URLs on the CLI:

| Key | Used for |
|---|---|
| `regressionBase` | BEFORE for regression (EDS `main` live) |
| `parityBase` | BEFORE for migration parity (the legacy/source site) — **fill this in** |
| `localCandidate` | AFTER for local runs (`http://localhost:3000`) |
| `threshold`, `viewports` | diff sensitivity + which sizes to capture |
| `checks` | **CI on/off toggles** — `regression`, `parity`, `fullpage`, `block` (all default `true`) |

**Turning CI checks on/off (`checks`):** the PR matrix is the cross-product of enabled **sources**
(`regression`/`parity`) × enabled **scopes** (`fullpage`/`block`). Set any to `false` to drop those checks —
e.g. `"parity": false` until migration starts, or `"block": false` early on. Disabled combos don't appear as
checks at all. These toggles are **CI-only**; a local `--mode`/`--scope` always runs regardless.

- **Locally:** the tool reads the config, so `--mode regression` uses `regressionBase` and `--mode parity` uses
  `parityBase` automatically. Any `--flag` overrides the config.
- **In CI:** the matrix builds BEFORE/AFTER from the PR description's `before=`/`live=`/`after=` URLs (per page);
  regression+fullpage falls back to `main` live vs the branch preview. `threshold`/`viewports` come from the config.

## One config file — `tools/quality/broadridge-visual.config.json`

Everything lives in a single file:

- **Origins** — `regressionBase`, `parityBase`, `localCandidate` (domains only, no paths).
- **Defaults** — `threshold`, `viewports`.
- **CI toggles** — `checks`.
- **`targets`** — the list of pages: per-page **paths** + **block selectors**. The tool joins
  `<origin> + <target path>`, so a domain is never repeated in a target.

## `targets` — one entry per page

Fields:

| Field | Side | Meaning |
|---|---|---|
| `edsPath` | EDS page (candidate + regression source) | the EDS path, e.g. `/cit` — appended to `localCandidate`/branch and `regressionBase` |
| `livePath` | live/legacy page (parity source) | the live-site path, e.g. `/cit` — appended to `parityBase`. Set it only if it **differs** from `edsPath` (defaults to `edsPath`) |
| `edsSelector` | EDS side | the EDS element's CSS (block scope), e.g. `.hero-banner` |
| `liveSelector` | live/legacy side | the live element's CSS (block scope, parity), e.g. `.et_pb_fullwidth_header` |
| `viewports` | — | *optional* override of the config viewports |
| `base` / `candidate` | — | *optional* full-URL escape hatch (reintroduces a domain — avoid unless a page truly needs it) |

> Aliases: `path`/`legacyPath` for `edsPath`/`livePath`; `block` (name → `.name`) / `selector` for `edsSelector`;
> `baseSelector` for `liveSelector`.

Example (CIT — the EDS and live pages share the `/cit` route here; set `livePath` differently when they don't):

```json
"targets": [
  { "edsPath": "/cit", "livePath": "/cit", "edsSelector": ".hero-banner", "liveSelector": ".et_pb_fullwidth_header" }
]
```

**Add each migrated page** to the `targets` array as you go — e.g. `{ "path": "/cit/products", "block": "cards" }`.
A page must resolve on **both** sides or it's **skipped with a warning** (never a crash) — expected mid-migration.

## Run it locally (pre-check)

Once: `npx playwright install chromium`. Start the dev server (`aem up`) so `localhost:3000` serves your branch.

```bash
npm run broadridge:test:visual -- \
  --base https://main--da-broadridge-cit--rrrragas.aem.live \
  --candidate http://localhost:3000
```

Diff images + a `summary.md` land in `tools/quality/visual-output/` (git-ignored). Open the `*-diff.png` files —
changed pixels are highlighted. Options: `--path /some/page` (one target), `--threshold 0.005`, `--report-only`.

> Caveat: `localhost` serves *previewed* content while `.aem.live` serves *published* content — content
> differences add noise. For a purer **code-only** diff, point `--base` at `main--…aem.page` (main preview).

## In CI — one matrix, four checks

`.github/workflows/broadridge-visual.yaml` runs a **2×2 matrix** on PRs that touch `blocks/** scripts/** styles/**
head.html` (or the visual tool/parser), producing four checks:

|  | fullpage | block |
|---|---|---|
| **regression** (`before=` vs `after=`) | whole page, main vs branch | one block, main vs branch |
| **parity** (`live=` vs `after=`) | whole page, legacy vs branch | one block, legacy vs branch |

- **Source** comes from the parser `--mode` (regression uses `before=`, parity uses `live=`).
- **Scope** comes from the tool `--scope` (block uses `block=<name>` → `.<name>`, or `selector=`).
- Artifacts: `visual-<mode>-<scope>-diff`. Each combo with no matching URLs is a **no-op** (regression+fullpage
  falls back to the default `main-vs-branch` manifest so it always has something to show).

All read the **PR description** — one line per changed page between the markers (see the PR template):

```
<!-- visual:start -->
- cit-hero | after=https://<branch>--…aem.page/cit/hero | before=https://main--…aem.live/cit/hero | live=https://legacy…/hero.html | block=hero-banner
<!-- visual:end -->
```

`tools/quality/broadridge-visual-parse-pr.mjs` turns those lines into a per-mode manifest;
`broadridge-visual-check.mjs` runs it at the chosen scope. The whole matrix can also be run from the **Actions**
tab (`workflow_dispatch`).

**Report-only for sprint one** (`continue-on-error`) — no combo fails the PR yet. To make one blocking (e.g.
regression+fullpage) once its baseline is clean, split that combo out or gate it; keep parity report-only (legacy
vs EDS is a visual reference, not a threshold gate).

### Locally — two skills
Use the **`broadridge-visual`** skill (or `npm run broadridge:visual:all`). With the config supplying base/candidate,
the commands are short:
```bash
# full page, regression (base=main live, candidate=localhost from config)
npm run broadridge:test:visual -- --scope fullpage --path /cit
# one block, regression
npm run broadridge:test:visual -- --scope block --block hero-banner --path /cit
# migration parity (base=config.parityBase)
npm run broadridge:test:visual -- --mode parity --scope block --block hero-banner --base-selector ".legacy-hero" --path /cit
```

## Reading a result

The summary table lists each `path @ viewport` with a diff % and status:
- **ok** — diff ≤ threshold (default 0.1%).
- **CHANGED** — diff > threshold; open the `-diff.png` and confirm the change is intentional.
- **skipped** — the path 404'd / errored on one side (e.g. not migrated yet). Not a failure.

## Handling intentional visual changes

There are no committed baselines to update — because "before" is always production. When you intentionally change
a block's look, the CHANGED status is expected; note it in the PR and attach/point to the diff artifact so a
reviewer can confirm it's deliberate. Once merged to `main` and published, it becomes the new production baseline
automatically.

## Threshold

Default `0.001` (0.1% of pixels), with pixelmatch `threshold: 0.1` + `includeAA: false` to suppress
anti-aliasing noise. Tune per project via `--threshold`.

## Element-by-element audit (`broadridge:audit:blocks`)

The pixel diff answers "do these look the same?" but for **migration parity** the % is always high (different
implementations), so it can't tell you *what* differs. The block audit (`broadridge-block-audit.mjs`) fills that
gap by working the way a QA reviewer does — **down a component element by element, reading every property of
each element** on the real legacy page and the real migrated page, at mobile/tablet/desktop, from computed
styles (not source markup, which the pipeline mutates).

### What each block spec must cover

A block entry in the `BLOCKS` map defines `captureLive(page)` / `captureEds(page)`. Each returns
`{ info, props }` — `info` names the matched node (so a mis-targeted selector is obvious and never silently
produces bad data), `props` is the flat, dot-pathed map that gets diffed. **Capture every distinct element a
reviewer would inspect, and every visible property of each:**

- **Every distinct element** — not just the block root. E.g. footer = bar + each link-group heading + nav link
  + copyright/legal line + social sub-bar. header = bar + logo + resting nav link + active nav link + hamburger.
- **Every visible property per element** — `color`, `background-color`, `font-size`, `font-weight`,
  `line-height`, `letter-spacing`, `text-transform`, `text-decoration`, `padding`/`margin`, `border-radius`,
  dimensions. If a QA person would eyeball it, capture it.
- **State, not just resting** — `contrastPairs` (WCAG AA per element), `hover` (declare the `prop` that changes;
  footer links change `color`, buttons change `background-color`), and active/current styling.

### Layout checks the property diff can't see

Two smells are invisible to a per-property diff and are checked separately (they were both missed in manual
review before being added):

- **Alignment** (`alignmentPairs`) — which side of its bar an element sits on. Catches *mirrored* layouts, e.g.
  a mobile hamburger rendered left when the source has it right. Uses `horizontalSide()` (left/right of centre),
  a low-false-positive heuristic; fine positional drift is left to the pixel diff.
- **Section transitions** (page-level, run once per viewport via `auditSectionTransitions()`) — flags an
  unintended white **band/gap** between sections where either is a colored band, and an **empty section shell**
  that still occupies space (e.g. the wrapper left after the page `metadata` block is extracted into `<head>`).

The pure helpers (`isColoredBand`, `horizontalSide`, `auditSectionTransitions`) live in
`lib/style-audit-utils.mjs` and are unit-tested (`test/style-audit-utils.test.js`).

### Adding a block to the audit

1. Add a `BLOCKS['my-block']` entry with `captureLive`/`captureEds`, listing every element + property.
2. Add `contrastPairs` for each text-on-background pair; add `hover` (with `prop`) and `alignmentPairs` if
   relevant.
3. Run `npm run broadridge:audit:blocks -- --block my-block --path /your-page` and confirm `info` shows the
   right nodes matched on both sides before trusting the `props` diff.
4. Severity (🔴/🟡/🟢) is auto-classified by `classify()` — allowlist genuinely intentional deviations rather
   than fighting the label.

## Generic content-anchored compare (`broadridge:compare`) — no per-block code

The block audit above is **precise but hand-authored**: every block needs a `captureLive`/`captureEds` pair, so
an un-specced block gets *zero* coverage (silently). `broadridge-visual-compare.mjs` is the **generic** engine —
it compares **any** two subtrees with no per-block code by matching nodes on **content** (role + normalized
text) instead of selectors. The two DOMs are unrelated (legacy markup vs clean EDS) but the text is the same,
so `"Collective Investment Trusts"` matches `"Collective Investment Trusts"` regardless of class names.

It reports three things at once, selector-free:
- **Style drift** on matched pairs (typography, color, box — via `classify()`, negligible deltas dropped).
- **Missing content** — a source node with no migrated match (this is how the footer's dropped description
  paragraph would be caught automatically).
- **Added content** — migration-only nodes.

Matching uses an **LCS** over content fingerprints (`matchNodes`), so a single insertion/deletion doesn't
cascade into a wall of false mismatches (the failure mode of index-based matching). A **silent-mismatch guard**
treats an empty/​not-found subtree as 🔴, never a pass.

### Two modes

```bash
# block/region mode (LOW NOISE — recommended): one selector on each side
npm run broadridge:compare -- --source-selector ".et_pb_fullwidth_header" --dest-selector ".hero-banner" --path /cit

# whole-page mode (BROAD — needs allowlist tuning): source main vs migrated main
npm run broadridge:compare -- --page /cit

# gate a run (exit non-zero on unexplained 🔴 / missing content)
npm run broadridge:compare -- --source-selector "footer" --dest-selector "footer" --path /cit --strict
```

### Precision vs coverage — pick the mode deliberately

- **Selector/region mode is production-ready and low-noise** — pointed at two matching subtrees it aligns
  cleanly (the hero run matched 100% and surfaced exactly one real finding, the H1 weight). Use this for
  block-level parity when you know the two selectors.
- **Page mode is broad but noisier** — role-keyed matching stumbles on heading-level shifts (h3→h4), links that
  wrap heading text (captured as one long string), and structural asymmetry (nav links live in different DOM
  spots). Treat its output as a *worklist*, and record genuine intentional deviations in the allowlist rather
  than chasing every row.

### Allowlist

Accepted deviations live in `tools/quality/visual-diff-allowlist.json` under a `compare` array; each entry is
`{ "kind": "missing" | "added", "textMatch": "<substring>" }` (matched case-insensitively on normalized text).
Use it for intentional differences — e.g. the source's live stock ticker (excluded on purpose) or a subhead the
source hides at a given viewport.

### When to use which

| Need | Tool |
|---|---|
| Precise, low-noise check of a block you've specced | `broadridge:audit:blocks` (hand-spec) |
| Any block/region, zero code, know both selectors | `broadridge:compare --source-selector … --dest-selector …` |
| Whole-page content-completeness sweep (new/un-specced pages) | `broadridge:compare --page` |
| "Do the pixels look the same?" visual backstop | `broadridge:test:visual` (pixel diff) |

The pure helpers (`normalizeText`, `roleOf`, `fingerprint`, `matchNodes`, `diffMatchedNode`) live in
`lib/style-audit-utils.mjs` and are unit-tested.
