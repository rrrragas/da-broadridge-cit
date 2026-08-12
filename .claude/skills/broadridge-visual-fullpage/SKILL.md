---
name: broadridge-visual-fullpage
description: "Use this to run a FULL-PAGE visual comparison of a Broadridge CIT page at mobile/tablet/desktop — either regression (EDS main vs your branch) or migration parity (legacy source site vs your branch). For a single block/section instead of the whole page, use broadridge-visual-block."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Full-page Visual Comparison

Screenshots an entire page on a BEFORE and an AFTER URL, diffs them with pixelmatch, and writes before/after/diff
PNGs to `tools/quality/visual-output/`. Full reference: [broadridge-VISUAL-TESTING.md](../../../docs/broadridge-VISUAL-TESTING.md).

## When to use
- **Regression:** confirm a code change didn't shift the *current* EDS page → BASE = EDS `main`, CANDIDATE = your branch.
- **Migration parity:** confirm a migrated page matches the *original* site → BASE = legacy URL, CANDIDATE = your branch.

## Run it (dev server up: `aem up`; once: `npx playwright install chromium`)

```bash
# Regression — main live vs local branch
npm run broadridge:test:visual -- --scope fullpage \
  --base https://main--da-broadridge-cit--rrrragas.aem.live --candidate http://localhost:3000 --path /cit

# Migration parity — legacy page vs local branch
npm run broadridge:test:visual -- --scope fullpage \
  --base https://www.legacy-cit-site.com/cit --candidate http://localhost:3000/cit
```

`--scope fullpage` is the default. Add `--path /one/page` to limit to a manifest entry, or point `--base`/`--candidate`
at any URLs. Open the `*-diff.png` files; changed pixels are highlighted.

## Reading it
- **ok** — diff ≤ threshold (default 0.1%). **CHANGED** — over threshold; open the diff and confirm intent.
- **skipped** — a URL 404'd (e.g. page not migrated yet) — not a failure.
- For **migration parity**, the pixel-% is usually high (legacy vs EDS are different implementations) — treat the
  images as a **side-by-side reference**, not a threshold gate.

## In CI
The `broadridge-visual.yaml` matrix runs `(regression|parity) × (fullpage|block)` on every PR touching block/page
code, reading `before=`/`live=`/`after=` URLs from the PR description. This skill is the local equivalent.

## Related
- `broadridge-visual-block` — same, but one block/section element.
- `broadridge-pr-readiness` — the PR definition of done.
