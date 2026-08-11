# Block Catalog — Broadridge CIT

The blocks available in this project, how authors create them, and what developers must know.
Keep this in sync when you add or change a block (it's part of the definition of done — see the
`broadridge-block-review` skill). Rules referenced here live in [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md).

Legend: **OOTB** = stock aem-boilerplate, unchanged · **OOTB-Extended** = boilerplate block with local
changes · **Custom** = project-specific.

| Block | Type | One-liner |
|---|---|---|
| [cards](#cards) | OOTB | Responsive grid of image + text cards |
| [columns](#columns) | OOTB | Side-by-side columns that stack on mobile |
| [hero](#hero) | OOTB-Extended | Full-bleed banner image with overlaid heading |
| [header](#header) | OOTB | Site navigation from the `/nav` fragment |
| [footer](#footer) | OOTB | Site footer from the `/footer` fragment |
| [fragment](#fragment) | OOTB | Embeds another EDS document inline |
| [widget](#widget) | Custom | Loads an external self-contained widget from `/widgets/` |

---

## cards
- **Authoring:** one row = one card. In a card, a cell that is only an image becomes the card image; any
  other cell becomes the card body (text/links). One or two columns per row both work.
- **Variants / metadata:** none.
- **Dev notes:** `decorate` rebuilds the block as `<ul><li>`; images are replaced with
  `createOptimizedPicture(..., 750, false)`. Image detection is strict — a cell counts as an image cell only
  if its single child is a `<picture>`. CSS forces `aspect-ratio: 4/3`.

## columns
- **Authoring:** a table of rows × columns; each cell is a column. Column count comes from the first row.
- **Variants:** auto class `columns-<n>-cols` from the first row's column count; an image-only cell gets
  `columns-img-col` (reordered above text on mobile).
- **Dev notes:** no imports; synchronous. Horizontal layout kicks in at `width >= 900px`.

## hero
- **Authoring:** an image/`<picture>` plus an `<h1>` (and optional text). If the hero is the first thing on
  the page, that heading must be the page's `h1` (SEO).
- **Variants:** none defined.
- **Dev notes:** **CSS-only** (`hero.js` is empty). The picture is absolutely positioned behind the content;
  the heading is forced to `var(--background-color)`, so **authors must use a dark enough image** for contrast.
  `hero-wrapper` removes section max-width/padding for full-bleed.

## header
- **Authoring:** content lives in a **separate fragment**, default `/nav` (override with page metadata key
  `nav`). The fragment's up-to-three sections map in order to brand, sections, tools. A nav-section `<li>`
  containing a nested `<ul>` becomes a dropdown.
- **Variants / metadata:** metadata key `nav`. State is driven by `aria-expanded` (no class variants).
- **Dev notes:** `async`; uses `loadFragment`. Desktop breakpoint `(min-width: 900px)`. Full keyboard/focus
  handling (Escape to close, focus-out collapse, Enter/Space to open dropdowns). Sets `body overflowY hidden`
  when the mobile menu is open. `position: fixed` on mobile, `relative` on desktop.

## footer
- **Authoring:** content in a **separate fragment**, default `/footer` (override with page metadata key
  `footer`).
- **Variants / metadata:** metadata key `footer`.
- **Dev notes:** `async`; uses `getMetadata` + `loadFragment`. Centered, max-width 1200px.

## fragment
- **Authoring:** a single cell with a **link** to the fragment path (or the path as text).
- **Variants:** none. Behaviour: if the fragment is a section's only child, the section is replaced by the
  fragment; otherwise the fragment's sections are flattened in place.
- **Dev notes:** exports `loadFragment`, reused by header/footer. Only same-origin absolute paths (`/…`, not
  `//…`) are loaded. Rewrites `./media_*` asset URLs to absolute. Re-runs `decorateMain` + `loadSections` on
  loaded content. **Use for non-canonical content** (per EDS-RULES §6). `fragment.css` is intentionally empty.

## widget (custom)
- **Authoring:** a single cell with a **link** whose href points to a widget asset, e.g.
  `/widgets/<path>/<name>.html?key=value`. Query-string params become the widget's config. Only the link is
  authored; the widget's markup/behaviour ships in code under `/widgets/`.
- **Variants:** effectively one per widget — the widget name becomes the block's class, and the
  wrapper/container are renamed to `<name>-wrapper` / `<name>-container` so CSS/JS can target it.
- **Dev notes:** `async`. `parseWidgetHref` derives name + sub-path from the URL. Applies the "shell"
  (classes + `data-*` from query params) **before** loading, so the widget JS can read config off the DOM.
  Then it `fetch`es `<name>.html` into the block, `loadCSS`es `<name>.css`, and dynamically `import()`s
  `<name>.js` (calling its default `decorate(block)`). Asset base is `window.hlx.codeBasePath` +
  `/widgets/`. Failures are caught and logged (block left as-is).
  - **Building a new widget:** put `<name>.{html,css,js}` under `<codeBasePath>/widgets/<path>/`; the JS should
    export a default `decorate(block)` and read params from `block.dataset.*`. The widget's own code must
    follow all of [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md) (safe URLs, no `eval`, a11y, etc.) — `broadridge:check:security` and
    `broadridge:check` do **not** scan `/widgets/` if it lives outside `blocks/`, so review widgets manually.

---

## Adding a block — conventions
- Prefer inferring structure from content patterns over config tables (David's Model). Push layout/behaviour
  to **section metadata** or a **variant**, not per-field config.
- Section-metadata keys are block-scoped and compact (e.g. `hero-align`, `cards-cols`). Read both
  `dataset.myKey` and `dataset.dataMyKey` (DA double-prefix).
- Document the new block here, add it to the relevant DA block library, and run `broadridge-block-review`.
