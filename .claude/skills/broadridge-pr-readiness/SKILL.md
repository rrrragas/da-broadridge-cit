---
name: broadridge-pr-readiness
description: "Use this when you are about to open, or are preparing, a pull request in the Broadridge CIT EDS project. Defines the project's definition of done — branch naming, PR description with before/after preview links and screenshots, green lint/build/checks, Lighthouse targets, multi-brand testing, and squash merge. Use before pushing a PR or when reviewing whether a PR is mergeable."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# PR Readiness — Definition of Done

The gate every change passes before it can merge. Rules and sources are in
[docs/broadridge-EDS-RULES.md](../../../docs/broadridge-EDS-RULES.md). For block-level correctness, run `broadridge-block-review` first.

## Branch

- [ ] Named `<issue-number>-<short-description>`, lowercase, max ~32 chars, no special characters.
      Example: `142-hero-eyebrow-variant`.
- [ ] Branched from up-to-date `main`.

## Checks are green (run locally before pushing)

- [ ] `npm run lint` — ESLint + Stylelint clean.
- [ ] `npm run broadridge:check` — breakpoints (600/900/1200), SVG size budget, color-token advisory.
- [ ] `npm run broadridge:test:a11y` — axe-core has no violations on the changed pages.

## PR description (required — a PR without these is rejected)

- [ ] Links the issue (`#<number>`).
- [ ] States what changed and why, briefly.
- [ ] **Before/after preview links** to the feature branch preview:
      `https://<branch>--da-broadridge-cit--<owner>.aem.page/<path>` for a page that demonstrates the change.
      Get owner/branch with `gh repo view --json nameWithOwner` and `git branch --show-current`.
      If no page exists, create test content (static HTML in `drafts/`, or ask the user to add a DA page) and link it.
- [ ] **Screenshots** (or a short clip) of the change, ideally mobile + desktop.

## Performance & quality gates

- [ ] Lighthouse **≥ 90 on every category** for the changed pages; aim for 100 on Performance.
- [ ] If heavy MarTech makes 100 impossible, note the tradeoff explicitly in the PR (don't hide it).
- [ ] Run PageSpeed Insights on the preview URL and address regressions
      (https://developers.google.com/speed/pagespeed/insights/?url=YOUR_PREVIEW_URL).

## Compatibility

- [ ] Tested against each brand/theme that shares this codebase (if multi-brand).
- [ ] Verified at mobile (<600), tablet (600–899 / 900), and desktop (≥1200) widths.
- [ ] No new third-party script in `head.html`; no new runtime dependency.

## Merge

- [ ] `gh pr checks` — code sync, lint, and performance checks all pass.
- [ ] **Squash merge** to keep history clean.

## Related skills

- `broadridge-block-review` — block-level self-review (run before this).
- `code-review` — deep review + posting findings/suggestions.
- `testing-blocks` — unit/browser testing guidance.
