# Migrate Broadridge CIT section to AEM Edge Delivery Services

Migrates the full Broadridge Collective Investment Trusts section
(`https://www.broadridge.com/cit/*`) from the legacy Divi/CrownPeak site into
this AEM Edge Delivery Services (Document Authoring) project.

## What's included

**~32 pages migrated** onto a lean, David's-Model-compliant block palette:

| Group | Pages |
|-------|-------|
| Landing | `/cit/` |
| Core siblings (7) | cit-services, matrix-cits, broker-dealer-platform, banks-and-trusts, tpas-and-record-keepers, financial-advisers, about-us |
| Fund detail (23) | all Matrix CIT fund family pages linked from the Matrix CITs grid |
| Legal | terms-and-conditions |
| Shared chrome | nav (header) + footer |

**Blocks (4 + chrome):** `hero-banner`, `cards` (feature + offerings variants),
`columns` (base + compare variants), `form-contact`, plus `header`/`footer`/`fragment`.
Boilerplate blocks (`cards`/`columns`/`hero`/`widget`) and Roboto fonts were removed.

**David's Model discipline:** prose, bulleted lists, PDF document links, and the
legal document are all default content — blocks were used only where structure
demands (repeating card grids, side-by-side columns, the interactive contact form).

## Design & accessibility

- Brand design tokens extracted from source (blue `#0050ae`, navy `#001f5a`,
  accent `#40b8ff`) applied to global styles + blocks.
- Real Matrix Trust header (with the MATRIX SOLUTIONS dropdown) and footer
  (two link groups + social + legal), replacing Adobe boilerplate.
- **WCAG 1.3.1:** heading hierarchy normalized across all 32 pages — 0 level
  skips, exactly one `<h1>` per page, sibling headings kept at equal level.
- All content images have alt text; no `javascript:`/empty links.

## Preview

- **Landing:** https://migrate-cit-section--da-broadridge-cit--rrrragas.aem.page/cit
- **Matrix CITs (offerings grid, 23 tiles):** https://migrate-cit-section--da-broadridge-cit--rrrragas.aem.page/matrix-cits
- **A fund page:** https://migrate-cit-section--da-broadridge-cit--rrrragas.aem.page/mutual-of-america-stable-value-cit
- **About Us:** https://migrate-cit-section--da-broadridge-cit--rrrragas.aem.page/about-us

## Checks

- `npm run lint` (ESLint + Stylelint): clean.
- AEM Code Sync: feature preview builds and renders migrated content + chrome.
- Lighthouse/PageSpeed: **run manually against the preview URL** (the API was
  quota-limited in the build environment). Target 100 per project standards.

## Known follow-ups

- **Contact form** (`form-contact`) is client-side only — no backend submission
  endpoint wired (out of scope for this pass).
- **Legal/policy footer links** use `#` placeholders (source used `javascript:void(0)`);
  real destinations to be supplied.
- **Matrix CITs fund pages** preserve source image/PDF URLs; asset optimization
  and local hosting are handled at DA publish time.
- **Boilerplate `index`** (repo root homepage) is untouched placeholder — not a
  CIT page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
