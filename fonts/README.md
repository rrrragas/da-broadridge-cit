# Fonts

## arimo-latin-400-normal.woff2, arimo-latin-700-normal.woff2

**Arimo** — an open, Arial-metric-compatible sans-serif by Steve Matteson (Ascender/Google).
Latin subset, weights 400 (Regular) and 700 (Bold).

- **License:** Apache License 2.0 — freely redistributable, so it is safe to commit and serve
  from any domain (unlike the proprietary FreightSans Pro used by the brand).
- **Source:** Google Fonts (`https://fonts.google.com/specimen/Arimo`).
- **Why it's here:** it backs the metric-matched `freightsans-fallback` faces in
  `styles/styles.css`. Arimo is metrically identical to Arial/Liberation Sans, so the
  `size-adjust` + ascent/descent overrides (measured from broadridge.com/cit against Arial)
  apply unchanged. The `local('Arial'), local('Liberation Sans'), local('Helvetica')` sources
  come first, so machines that already have an Arial-metric font download zero bytes; this file
  is only fetched where none of those exist (e.g. many Linux browsers and headless CI), which is
  exactly where an un-backed `local()`-only fallback would otherwise fail and cause layout shift.

When a licensed FreightSans Pro web font is available it renders first (see `styles/fonts.css`);
these files then serve only as the pre-load fallback.

## FreightSans Pro web fonts

`freightsans-pro-{light,book,medium,semibold}.woff2` are the delivered webfont faces. They are
registered as the `freightsans` family in `styles/fonts.css`; the Hero additionally uses the
source-compatible Book and Light aliases for exact migration parity. `modules.ttf` is an unrelated
icon font and is not used.
