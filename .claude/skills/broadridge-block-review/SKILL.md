---
name: broadridge-block-review
description: "Use this when you have created or modified an EDS block (JS/CSS) in the Broadridge CIT project and want a self-review before opening a PR. Runs the project block checklist — content model, scoped CSS, breakpoints, security, accessibility, performance — layered on top of the stock code-review, building-blocks, and content-modeling skills. Also use when reviewing someone else's block change."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Broadridge Block Self-Review

Run this checklist against every block change **before** opening a PR. It encodes the project rules in
[docs/broadridge-EDS-RULES.md](../../../docs/broadridge-EDS-RULES.md) as concrete, checkable items and adds Broadridge-specific
deltas. It complements — does not replace — the stock skills: run `content-modeling` when the block's authored
structure changes, `building-blocks` while implementing, and `code-review` for the deep pass.

## How to use

1. Read the changed `blocks/<name>/<name>.js` and `.css`.
2. Walk every section below; fix violations before committing.
3. Run the machine checks: `npm run lint && npm run broadridge:check`.
4. Then run the `broadridge-pr-readiness` skill for the PR itself.

## Content model (author-facing structure)

- [ ] The authored structure is the simplest that works. Prefer inferring meaning from content patterns
      (first `h1` = headline, italic line = eyebrow, first image = media) over a config table of named fields.
- [ ] Layout/behaviour toggles live in **section metadata** or a **block variant**, not per-cell config.
- [ ] If the block renders a page's leading heading, it is an `h1` (not a styled `<p>`) — SEO impact.
- [ ] Heading hierarchy is correct and unskipped.
- [ ] Graceful with missing/extra cells: safe fallback or hidden section, never a thrown error.

## JavaScript

- [ ] Single **default** export named `decorate(block)` (may be `async`). Utilities are **named** exports.
- [ ] No `throw`. Failure path is a safe fallback + `console.warn('<block-name>: ...')` — never a bare `return`.
- [ ] All DOM queries scoped to `block` (`block.querySelector`), never `document`.
- [ ] No state on `window`; instance state stays local.
- [ ] Imports use `.js` extensions. Independent async work uses `Promise.all`.
- [ ] Images built with `createOptimizedPicture` from `scripts/aem.js`; LCP candidate is eager, rest lazy.

## CSS

- [ ] Every selector scoped to `.<block-name>`. No `.<block-name>-container` / `-wrapper`.
- [ ] Breakpoints only at 600 / 900 / 1200, mobile-first, `min-width` semantics
      (`@media (width >= 900px)` or `min-width:`). No `max-width` conditions, no `min`/`max` mixing.
- [ ] No `!important`. No `:nth-child` used as a logic hook.
- [ ] Colors/typography use tokens from `styles/styles.css` (`--text-color`, `--link-color`,
      `--body-font-size-*`, …). New need → add a token, don't inline raw hex.
- [ ] Variants selected via `[data-*]` attributes, not stacked class names.
- [ ] `:focus-visible` styled; focus outline never removed without replacement.
- [ ] `prefers-reduced-motion` respected for any animation/transition.
- [ ] Interactive targets ≥ 44×44px.

## Security

- [ ] DOM built with `createElement`/`textContent`. No unsanitized `innerHTML`.
- [ ] Only safe URL protocols pass through (`http`, `https`, `mailto`, `tel`, relative, hash); `javascript:`,
      `data:`, `vbscript:` rejected.
- [ ] `rel="noopener noreferrer"` on any `target="_blank"`.
- [ ] No secrets in client code; any server call needing a secret goes through an edge worker / middleware.

## Accessibility

- [ ] Content images have descriptive `alt`; decorative images use `alt=""`.
- [ ] Fully keyboard operable; visible focus; logical tab order.
- [ ] ARIA only where native semantics are insufficient, and used correctly.
- [ ] `npm run broadridge:test:a11y` passes for a page using this block.

## Broadridge project deltas

- [ ] Design tokens are defined/extended in `styles/styles.css` `:root` (and its `@media (width >= 900px)`
      override), not per-block.
- [ ] Anything gated on consent uses `scripts/consent-check.js` / `scripts/consented.js`; consent/analytics
      never load in `head.html` or the eager phase.
- [ ] Blocks that pull external assets follow the existing `blocks/widget/` pattern (load from
      `/widgets/{path}/{name}.{html,css,js}` via `window.hlx.codeBasePath` + `loadCSS`), rather than inventing
      a new external-loading mechanism.
- [ ] If the codebase serves multiple brands, the block was checked against each brand's tokens/theme.

## Related skills

- `content-modeling` — designing the authored structure.
- `building-blocks` — implementation patterns.
- `code-review` — full review pass and posting findings.
- `broadridge-pr-readiness` — the PR-level definition of done.
- `broadridge-i18n-rtl` — if the block renders user-facing text or must mirror for RTL.
