Please always provide the [GitHub issue(s)](../issues) your PR is for, as well as test URLs where your change can be observed (before and after):

Fix #<gh-issue-id>

Test URLs:
- Before: https://main--{repo}--{owner}.aem.live/
- After: https://<branch>--{repo}--{owner}.aem.live/

## Definition of done

See the `broadridge-pr-readiness` skill and [docs/broadridge-EDS-RULES.md](../docs/broadridge-EDS-RULES.md).

- [ ] Branch named `<issue>-<short-desc>` (lowercase, ≤32 chars)
- [ ] Screenshots (mobile + desktop) of the change attached
- [ ] `npm run lint` passes
- [ ] `npm run broadridge:check` passes (breakpoints, SVG size, color/security advisories, redirect map)
- [ ] `npm run broadridge:test:unit` passes
- [ ] `npm run broadridge:test:a11y` passes (no axe-core WCAG 2.1 A/AA violations)
- [ ] Lighthouse ≥ 90 all categories on the changed pages (target 100); MarTech tradeoffs noted if 100 isn't reachable
- [ ] No new third-party script in `head.html`; no new runtime dependency
- [ ] Tested against each brand/theme if this codebase is multi-brand
- [ ] Squash merge
