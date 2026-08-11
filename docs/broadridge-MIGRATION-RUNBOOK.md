# Migration Runbook — Broadridge CIT

The end-to-end process for migrating pages onto EDS without losing SEO equity or traffic. Grounded in the EDS
Playbook (SEO-parity focus) and the Solution Design Document (§10 Migration Strategy). Companion docs:
[broadridge-SEO-METADATA.md](broadridge-SEO-METADATA.md), [broadridge-EDS-RULES.md](broadridge-EDS-RULES.md). The engagement's own plan/estimate live in
`migration-planning/`.

## Phase 0 — Inventory & baseline
- [ ] Crawl the legacy site; build a **page inventory** (URL, title, template, traffic, indexed y/n).
- [ ] Pull a performance/traffic **baseline** from Google Search Console + RUM (not one-off Lighthouse — lab
      scores fluctuate; use a trailing window). Record LCP/CLS/INP, impressions, clicks, top pages.
- [ ] Identify non-indexed/orphan pages — decide migrate vs drop.
- [ ] Identify **common content** → fragments (nav, footer, disclaimers) and **placeholder** content
      (frequently-changed shared strings) → placeholders sheet.

## Phase 1 — Content modeling
- [ ] Map each legacy template to EDS sections + blocks (use the `page-import` skill; see [broadridge-BLOCKS.md](broadridge-BLOCKS.md)).
- [ ] Validate every piece of content lands in an appropriate block; re-author metadata per
      [broadridge-SEO-METADATA.md](broadridge-SEO-METADATA.md).
- [ ] Confirm authoring approach (DA vs UE) and asset strategy (Media Bus vs remote DAM).

## Phase 2 — Redirects (SEO-critical)
- [ ] Build the **redirect map**: every legacy URL → new EDS URL. Live map is the DA `redirects` sheet
      (published to `/redirects.json`); optionally mirror it to a git-tracked `redirects.csv` for review.
- [ ] `redirects.csv` format — header `Source,Destination`, absolute-path sources, no self-redirects, no
      duplicate sources. Validate with `npm run broadridge:check:redirects`.
- [ ] Use **301 (permanent)** redirects to preserve link equity. Preserve original URL structure where possible.
- [ ] Cross-check the map against the Phase-0 inventory — no high-traffic URL left unmapped.

## Phase 3 — Pre-cutover QA
- [ ] Metadata: `title`/`description`/`canonical`/share image present in first-pass markup (`curl`, no JS).
- [ ] hreflang reciprocity for localized pages; preview hosts (`*.aem.page`) are `noindex`.
- [ ] `npm run lint && npm run broadridge:check && npm run broadridge:test:unit`; a11y (`npm run broadridge:test:a11y`) on key templates.
- [ ] Lighthouse ≥ 90 (target 100) on home + top templates; note any MarTech tradeoff.
- [ ] Visual + content parity spot-check vs legacy (esp. multilingual, RTL — client owns content proofing).

## Phase 4 — Content freeze & cutover
- [ ] Announce a **content freeze** window on the legacy CMS.
- [ ] Final delta sync of anything changed during migration.
- [ ] Switch DNS / CDN origin to EDS (coordinate BYOCDN if used). Confirm TLS + security headers
      ([broadridge-SECURITY-HEADERS.md](broadridge-SECURITY-HEADERS.md)).
- [ ] Verify redirects resolve on the production domain (spot-check top 20 legacy URLs → 301 → new URL).

## Phase 5 — Post-launch monitoring
- [ ] Watch for **404 spikes** and unmapped URLs; patch the redirect map (Phase 2) as needed.
- [ ] Resubmit sitemaps; watch Search Console **coverage** + **Core Web Vitals** (trailing 28-day CrUX window
      — expect a few weeks before field data fully reflects the new site).
- [ ] Compare against the Phase-0 baseline; capture before/after for the value readout.
- [ ] Keep RUM dashboards under weekly review during the stabilization period.

## Rollback / fix-forward
- Prefer **fix-forward** (EDS deploys in seconds via Code Sync). For a bad content change, republish the prior
  version; for a bad code change, revert the commit to `main`. Keep the legacy site reachable (un-cut) until
  post-launch metrics are green.
