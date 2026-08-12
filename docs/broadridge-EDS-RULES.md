# EDS Rules & Guardrails — Broadridge CIT

Project-specific best-practice rules for this AEM Edge Delivery Services (EDS) project, for **both human
developers and AI coding tools**. This is the detailed reference; the short version lives in
[AGENTS.md → Best Practices & Guardrails](../AGENTS.md), which is auto-loaded into every AI session.

**How to read this file.** Every rule is tagged:

- `[enforced-by: <tool>]` — a script, linter, or CI job checks this automatically. Breaking it fails a check.
- `[review-only]` — not machine-checked yet; verify it in self-review and code review (see the
  `broadridge-block-review` and `broadridge-pr-readiness` skills).

Governing principle (from the field — see Sources): **a rule a script enforces beats a rule the agent must
remember.** Where a `[review-only]` rule proves important and checkable, promote it to a checker.

---

## 1. Architecture & core

- **Never modify `scripts/aem.js`.** Put shared/common code in `scripts/scripts.js`. `[review-only]`
- **No build step, zero runtime dependencies.** Native ES modules only; always include the `.js` extension
  in imports. `[enforced-by: eslint]`
- **No third-party scripts in `head.html`.** Analytics, consent, tag managers, and other integrations load in
  the **delayed** phase (`scripts/delayed.js` / `scripts/consent-check.js`) only. `[review-only]`
- **Content-first (David's Model).** Blocks are not great for authoring — prefer inferring structure from
  content patterns (e.g. first `h1` = headline, italic line = eyebrow) over config-heavy block tables.
  Push layout/behaviour choices to **section metadata** or **block variants**, not per-field config. `[review-only]`
- **Respect three-phase loading** (eager → lazy → delayed). Block decoration runs in eager/lazy; never put
  block code in `delayed.js`. `[review-only]`

## 2. CSS

- **Breakpoints: 600 / 900 / 1200.** Mobile-first, `min-width` semantics only. This repo uses the modern
  range syntax `@media (width >= 900px)`; the classic `@media (min-width: 900px)` is equivalent and also
  allowed. **Never** use `max-width` in a media-query condition and **never** mix `min-`/`max-` breakpoints.
  `[enforced-by: breakpoint-check]`
  > Note: `EDS-Development-Best-Practices.docx` lists 767/1024 — that is **overridden**. Adobe's published
  > standard (aem.live) and this project both use 600/900/1200. The doc values are reference only.
- **Scope every selector to `.{blockname}`.** Avoid `.{blockname}-container` / `.{blockname}-wrapper` (those
  are section-level classes and are confusing on blocks). `[review-only]`
- **No `!important`.** No positional selectors (`:nth-child`) used as logic/hooks. `[review-only]`
- **Prefer design tokens** (CSS custom properties in `styles/styles.css`: `--text-color`, `--link-color`,
  `--body-font-size-*`, etc.) over hardcoded colors. Add new tokens rather than raw hex in blocks. `[enforced-by: color-token-check]` (advisory, `blocks/` only)
- **Variants via data attributes** (`.my-block[data-align="center"]`), not stacked classes. `[review-only]`
- **Accessibility in CSS:** always style `:focus-visible`; never remove a focus outline without a replacement.
  Respect `prefers-reduced-motion`. Minimum tap target 44×44px. `[review-only]`

## 3. JavaScript / blocks

- **Block entry point:** single **default** export named `decorate(block)` (may be `async`). Utilities are
  **named** exports. (The doc's "named exports only" advice does not apply to the block entry point.) `[review-only]`
- **Never throw from a block.** On missing/malformed content, render a safe fallback or hide the section, and
  `console.warn('block-name: ...')`. Never fail silently with a bare `return`. `[review-only]`
- **Scope DOM queries to `block`** (`block.querySelector`), never `document`. Keep state local to the block
  instance; never attach to `window`. `[review-only]`
- **Async:** `async/await` over nested promises; `Promise.all` for independent parallel calls. `[review-only]`

## 4. Security

- **No `eval`, `new Function`, `document.write`, or `javascript:`/`vbscript:` URL literals.** `[enforced-by: security-check]`
- **Build DOM with `createElement`/`textContent`.** Avoid unsanitized `innerHTML` (Trusted Types are enabled
  in the CSP — see [broadridge-SECURITY-HEADERS.md](broadridge-SECURITY-HEADERS.md)). `[enforced-by: security-check]` (advisory on `innerHTML`)
- **Safe URL protocols only:** allow `http`, `https`, `mailto`, `tel`, relative paths, and hash anchors; block
  `javascript:`, `data:`, `vbscript:`. Use `isSafeUrl()` from [`scripts/broadridge-utils.js`](../scripts/broadridge-utils.js).
  Enforce `rel="noopener noreferrer"` on `target="_blank"`. `[review-only]` (protocol literals `[enforced-by: security-check]`)
- **No committed secrets.** Server-side secrets (API keys, tokens) go through **edge workers / middleware**,
  never client-side block code. `[review-only]`
- **Don't weaken the CSP** in `head.html` to make code work — fix the code. See [broadridge-SECURITY-HEADERS.md](broadridge-SECURITY-HEADERS.md). `[review-only]`

## 5. Images & performance

- **Use `createOptimizedPicture`** from `scripts/aem.js`. Mark the LCP candidate `eager`; everything else lazy. `[review-only]`
- **Protect CLS:** reserve space for async/dynamic content (skeletons, fixed aspect ratios). `[review-only]`
- **Committed asset budget:** SVGs warn at >8KB, fail at >40KB; convert oversized vectors to 2× PNG. `[enforced-by: svg-size-check]`
- **Lighthouse:** target 100, **≥90 mandatory** on every page. Be honest with stakeholders: heavy MarTech
  (Adobe Launch/Alloy/consent) makes a perfect 100 unrealistic — use the `aem-martech` plugin patterns and
  treat the gap as a documented business tradeoff, not a bug. `[enforced-by: lighthouse/PSI CI]`
- **Visual regression:** block/page changes are diffed against production/live at mobile/tablet/desktop; review
  the diff and confirm any change is intentional. See [broadridge-VISUAL-TESTING.md](broadridge-VISUAL-TESTING.md). `[enforced-by: visual CI (report-only)]`

## 6. SEO

- **Canonical content lives in the first-pass semantic markup.** All canonical page content (in `main`) and
  metadata (in `head`) must be present without JavaScript. Only **non-canonical** content (headers, footers,
  supplementary widgets) may be deferred/fragment-loaded. `[review-only]`
- **On migration:** preserve URLs, add 301 redirects, canonical tags, and standardized metadata (title,
  description, keywords, author, publish date). `[review-only]`

## 7. Internationalization, RTL & accessibility

- **Never hardcode user-facing text.** Use placeholders with fallbacks; camelCase keys; contextual names. `[review-only]`
- **Locales:** ISO codes in URLs (`/en/`, `/ar/`); `Intl` API for dates, numbers, currency; consider language
  *and* region (`en-US` vs `en-GB`). `[review-only]`
- **RTL:** use CSS logical properties (`inline-start`/`inline-end`, `margin-inline`, etc.), never physical
  `left`/`right`, for layout that must mirror. `[review-only]`
- **WCAG 2.1 AA:** correct heading order (one `h1`, no skipped levels); alt text — descriptive for content
  images, `alt=""` for decorative; sufficient contrast; full keyboard access; ARIA where semantics need it. `[enforced-by: axe-core CI]`

## 8. Visual parity vs. the source (migration)

The single most common migration defect is silent drift: block code changes but no longer matches the
original site. Three render targets exist and are **not** equal — never confuse them:

1. **Source** — `broadridge.com/cit/*`, the design truth.
2. **Local content** — `content/*.plain.html` (static; pre-pipeline).
3. **Live preview** — `{branch}--{repo}--{owner}.aem.page` (post-delivery-pipeline: strips bare `#fragment`
   hrefs, gzips, rewrites images to `<picture>`, etc.).

**Rules:**
- **Always verify rendered output, never raw static HTML.** A change "confirmed" against `.plain.html` or a
  file read can still differ live (e.g. the pipeline flattening `#talk-to-us` → `/`). Verify against the
  local render (headless) and, before a PR, against the **live preview**. `[enforced-by: visual-diff hook (advisory) + pre-PR critique]`
- **`source-baseline.json` is the truth to diff against.** `tools/quality/source-baseline.json` holds the
  source's per-block computed styles (colors, fonts, sizes, section backgrounds). Recapture only when the
  source legitimately changes.
- **The visual-diff hook runs after every `blocks/**` or `styles/*.css` edit** (`broadridge-visual-diff.mjs`,
  advisory): it renders each changed block against fixture content, extracts computed styles, and prints any
  drift vs. the baseline. Address flagged drift — either fix the block CSS, or, if intentional, add it to
  `tools/quality/visual-diff-allowlist.json` with a reason. Run manually: `npm run broadridge:check:visual`.
- **Intentional deviations are documented, not silent.** The FreightSans→fallback stack, single vs. alternating
  greys, form-as-section (not modal), and hero scrim live in `visual-diff-allowlist.json`. Anything not listed
  is treated as a real regression.
- **Before any PR, run the full parity pass** against the live preview: `excat-visual-critique` (page/site
  mode) + `npm run broadridge:test:a11y -- <preview-urls>` for layout, imagery, and a11y the per-block hook
  can't see. `[enforced-by: broadridge-pr-readiness]`

---

## Sources & attribution

**Attached expert docs**
- *EDS Playbook* (Shubham Bansal) — engagement lifecycle, KPIs, migration/SEO-parity, authoring strategy, governance.
- *EDS Solution Design Template v1.0* — architecture, block-spec standard, Lighthouse ≥90 CI gates, design tokens, NFRs.
- *EDS Development Best Practices* (Nishant Gupta) — branch/PR, CSS/JS/i18n/a11y/security dev rules. (Breakpoints overridden; see §2.)

**Official documentation**
- https://www.aem.live/docs/dev-collab-and-good-practices — authoritative baseline (breakpoints, scoped CSS, no build, never modify `aem.js`).
- https://www.aem.live/developer/keeping-it-100 — Lighthouse/PSI PR checks.
- https://www.aem.live/docs/davidsmodel — content modeling.
- https://www.aem.live/docs/seo-geo — canonical markup & SEO.
- https://docs.da.live/ — Document Authoring.

**Internal engineering guidance** — several rules (the three-tier governance model and "Executable-Rule Rule",
data-attribute block variants, content-first modeling, canonical-markup SEO, MarTech/Lighthouse tradeoffs,
axe-core a11y gating) reflect current internal AEM engineering practice gathered from team discussion. Names and
channels are omitted here.

**Email inputs — TBD.** Fold in relevant email guidance in a later pass.
