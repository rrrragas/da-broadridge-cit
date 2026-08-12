---
name: broadridge-visual
description: "Use this to run visual comparison checks for the Broadridge CIT site — full-page or block/section level, and either regression (EDS main vs your branch) or migration parity (legacy source site vs your branch), across mobile/tablet/desktop. Use for 'visual test', 'compare the hero', 'did my change shift the layout', 'does the migrated page match the live site'."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Broadridge Visual Comparison

Screenshots a BEFORE and an AFTER page (or one block on each), diffs them with pixelmatch, and writes
before/after/diff PNGs to `tools/quality/visual-output/`. Two knobs:

- **Scope** — `--scope fullpage` (whole page) or `--scope block` (one element; low-noise, precise).
- **Mode** — `--mode regression` (before = EDS main) or `--mode parity` (before = the legacy/live site).

Pages, selectors, origins, and thresholds all live in `tools/quality/broadridge-visual.config.json`
(`targets` = the pages), so commands are short. Full reference:
[broadridge-VISUAL-TESTING.md](../../../docs/broadridge-VISUAL-TESTING.md).

## Run it (dev server up: `aem up`; once: `npx playwright install chromium`)

```bash
# everything — all enabled combos (regression|parity × fullpage|block) over every config target:
npm run broadridge:visual:all

# or a single combo (scope + mode; base/candidate come from the config):
npm run broadridge:test:visual -- --scope fullpage --path /cit                # regression, full page
npm run broadridge:test:visual -- --scope block    --path /cit                # regression, block
npm run broadridge:test:visual -- --mode parity --scope block --path /cit     # parity, block
```

Any `--flag` overrides the config (`--base`, `--candidate`, `--block`, `--selector`, `--threshold`).

## Reading the result
- **ok** — diff ≤ threshold (0.1%). **CHANGED** — over threshold; open the `-diff.png` and confirm it's intentional.
- **skipped** — a page 404'd or a selector wasn't found on one side (expected mid-migration).
- **Regression** % is meaningful/low-noise (EDS vs EDS). **Parity** % is naturally high (legacy vs EDS are
  different implementations) — there, read the **before/after images**, not the number.

## In CI
The `broadridge-visual.yaml` matrix runs the same combos on PRs, driven by the PR description's `visual:start`
URLs (see the PR template). This skill is the local equivalent.

## Related
- `broadridge-block-review` — block self-review (run this visual check as part of it).
- `broadridge-pr-readiness` — the PR definition of done.
