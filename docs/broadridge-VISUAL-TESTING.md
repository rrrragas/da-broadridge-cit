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

### Per-page overrides (when legacy paths differ)

If a legacy URL doesn't share the new EDS path, give the target its own full `base` (and/or `candidate`) URL:

```json
[
  { "path": "/cit", "viewports": ["mobile", "tablet", "desktop"] },
  { "path": "/cit/hero", "base": "https://www.legacy-cit-site.com/investor/hero.html" }
]
```

`/cit/hero`'s "before" is the explicit legacy URL; its "after" is `<candidate>/cit/hero`. Targets without a
`base` fall back to `<--base origin> + path` as usual.

## Targets — `tools/quality/broadridge-visual-targets.json`

```json
[
  { "path": "/", "viewports": ["mobile", "tablet", "desktop"] }
]
```

Seeded with `/`. **Add each migrated page path** here — ideally the homepage plus one representative page per
template (article, product/PLP, contact, etc.) as they migrate. A path must exist on **both** base and candidate
to be compared; otherwise it's **skipped with a warning** (never a crash), which is expected mid-migration.

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
Use **`broadridge-visual-fullpage`** or **`broadridge-visual-block`**. With the config supplying base/candidate,
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
