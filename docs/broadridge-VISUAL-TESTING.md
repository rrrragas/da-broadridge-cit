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

### Setting the source site

- **CI (all PRs):** set a repo **variable** `VISUAL_BASE_URL` (Settings → Secrets and variables → Actions →
  Variables) to the legacy site origin, e.g. `https://www.legacy-cit-site.com`. The workflow uses it as BASE.
- **CI (one-off):** run the workflow manually (Actions → Visual regression → *Run workflow*) and pass `base`
  (and optionally `candidate`) inputs.
- **Locally:** pass `--base https://www.legacy-cit-site.com`.

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

## In CI

`.github/workflows/broadridge-visual.yaml` runs on PRs that touch `blocks/**`, `scripts/**`, `styles/**`,
`head.html`, or the visual tool/manifest. It waits for the branch preview, diffs live-vs-branch, writes a table
to the **job summary**, and uploads the before/after/diff PNGs as a **`visual-diff` artifact**.

**Report-only for sprint one** (`continue-on-error`) — it never fails the PR yet. To make it blocking once the
baseline is clean: remove the two `continue-on-error: true` lines and drop `--report-only`.

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
