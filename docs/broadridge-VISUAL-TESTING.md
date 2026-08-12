# Visual Regression Testing — Broadridge CIT

Screenshots and diffs pages when block or page code changes, so unintended layout/style regressions are caught
before merge. Runs as a **local pre-check** and a **PR CI job**. Rules: [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md).

## Model

Compare **production/live (before)** against the **current branch (after)** for a manifest of page paths, at
mobile / tablet / desktop. Both sides are rendered by the same browser, so there are **no baseline PNGs in git**
and no font/anti-aliasing platform mismatch. This doubles as **migration-parity QA**: "does the new EDS page
still match production?"

- Base (before): `https://main--da-broadridge-cit--<owner>.aem.live` (production/live)
- Candidate (after): `https://<branch>--da-broadridge-cit--<owner>.aem.page` (branch preview), or `http://localhost:3000` locally

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
