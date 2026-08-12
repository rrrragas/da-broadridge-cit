---
name: broadridge-visual-block
description: "Use this to run a BLOCK / SECTION-level visual comparison in Broadridge CIT — screenshots just one element (an EDS block by name → its .class, or a raw CSS selector) instead of the whole page, then diffs BEFORE vs AFTER at mobile/tablet/desktop. Less noise than full-page. For the whole page, use broadridge-visual-fullpage."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Block-level Visual Comparison

Screenshots a single element on the BEFORE and AFTER pages (not the whole page) and diffs them — precise, low-noise,
pinpoints the block you changed. Full reference: [broadridge-VISUAL-TESTING.md](../../../docs/broadridge-VISUAL-TESTING.md).

## Targeting the block
- **Block name (preferred):** `--block hero-banner` → the EDS class `.hero-banner`.
- **Raw selector:** `--selector "#main .cards"` for anything custom.
- **Parity note:** in migration parity the BASE is a *legacy* page whose markup differs, so `.hero-banner` won't
  exist there — pass `--base-selector "<legacy CSS>"` for the before side (the block name/selector still applies to
  the after side). Without it, the base is skipped ("selector not found") — which the summary reports honestly.

## Run it (dev server up: `aem up`; once: `npx playwright install chromium`)

```bash
# Regression — hero block: main live vs local branch
npm run broadridge:test:visual -- --scope block --block hero-banner \
  --base https://main--da-broadridge-cit--rrrragas.aem.live --candidate http://localhost:3000 --path /cit

# Migration parity — hero block vs legacy element
npm run broadridge:test:visual -- --scope block --block hero-banner --base-selector ".legacy-hero" \
  --base https://www.legacy-cit-site.com/cit --candidate http://localhost:3000/cit
```

Diff PNGs land in `tools/quality/visual-output/`. A target with no block/selector is **skipped** ("block scope
needs block= or selector=").

## In CI
The `broadridge-visual.yaml` matrix runs the `block` scope from `block=`/`selector=` fields in the PR description's
`visual:start` block. This skill is the local equivalent.

## Related
- `broadridge-visual-fullpage` — whole-page comparison.
- `broadridge-block-review` — the block self-review checklist (run this visual check as part of it).
