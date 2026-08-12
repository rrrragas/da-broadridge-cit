# Broadridge CIT Section — EDS Migration: Effort Estimation & Delivery Plan

> **▶ Execution readiness / action required:** You've asked me to enable the plugin and create the document. These are file-writing actions (write `.agents/settings.json`, save `docs/cit-migration-plan.md`, generate the PDF) and **plan mode does not permit file changes** — please **switch to Execute mode** and I'll run this immediately, in order:
> 1. Write `.agents/settings.json` → `{"enabledPlugins": {"project-management@excat-extended": true}}` (enables PDF generation). No restart needed — the plugin activates on the following message.
> 2. Save this artifact to `docs/cit-migration-plan.md`.
> 3. On the next message (once the plugin has loaded), generate the polished stakeholder **PDF** via the project-management skill.
>
> *Note: because the plugin only becomes available after the write + reinit, PDF generation lands one message after enabling — the Markdown doc is saved right away.*

## Purpose
A fresh, ground-up estimation and delivery plan for migrating the **entire** Broadridge Collective Investment Trusts section (`https://www.broadridge.com/cit/*`) into this AEM Edge Delivery Services (Document Authoring) project. **All existing boilerplate blocks and content are treated as throwaway** — every block, style, navigation, footer, and page below is net-new work. Findings were **fact-checked across three re-scraping passes** and this response includes a **self-critique** of the prior estimate. To be packaged as a shareable stakeholder document (editable Markdown in the repo + a polished PDF).

## Fact-Check & Self-Critique (corrections to prior estimate)
Three verification passes were run. The prior artifact had two material errors and one confirmed detail:

| Prior claim | Verified reality | Impact on estimate |
|---|---|---|
| MATRIX SOLUTIONS is a "multi-level dropdown / megamenu"; nav is the highest-risk block (12–20h) | **It is a simple 4-link text dropdown** (Broker-Dealers, Banks & Trusts, TPAs & Recordkeepers, Financial Advisers) — no columns, images, or descriptions | **Corrected DOWN**: nav revised to 8–14h; removed "megamenu" as top risk |
| matrix-cits grid = "~21+ items"; underlying fund pages **OUT of scope** | **Exactly 22 image-card items, each linking to an internal `/cit/` fund detail page** (e.g. `/cit/mutual-of-america-stable-value-cit`). User confirmed **all `/cit/*` is in scope** | **Corrected UP (major)**: adds ~22 fund detail pages → roughly doubles page count; requires a fund-detail template + bulk import |
| Social icons "Facebook, Twitter, LinkedIn, YouTube" | Confirmed exact destinations (Broadridge accounts) | No change |

**Honest critique of my own numbers:**
- The prior "8-core-pages" framing **understated total scope** because I speculatively excluded the fund pages instead of verifying they were internal. That was the biggest gap. Now closed.
- Estimates are **top-down ideal-hours ranges**, not bottom-up per-component measurements — treat ±30% as realistic until the reference page is actually built.
- The **22 fund pages are assumed templated/homogeneous**. If they vary significantly (different layouts, embedded performance tables, disclosures per fund), the bulk line could grow. This is the single largest remaining uncertainty and is flagged as a risk.
- Contact-form is still **client-side only**; no backend wiring is costed.

## Scope (confirmed — full `/cit/*`)
**~31 pages total.**

**A. Core section pages (8):**
1. `/cit/` — Home / landing (reference page)
2. `/cit/cit-services` — "Collective Investment Trust Services" (+ brochure download card)
3. `/cit/matrix-cits` — "Matrix Trust Company CITs" (**22-item offerings grid** → fund pages)
4. `/cit/broker-dealer-platform` — 3 feature cards + diagram
5. `/cit/banks-and-trusts` — 5-item feature list + diagram
6. `/cit/tpas-and-record-keepers` — bullet list + diagram
7. `/cit/financial-advisers` — two-column bullet list
8. `/cit/about-us` — "Matrix Trust Company" value-prop + solutions list + branding

**B. Fund detail pages (~22)** linked from the matrix-cits grid (e.g. `mutual-of-america-stable-value-cit`, `pacific-life-income-horizon-cits`, `equity-armor-cits`, …). Assumed to share a common **fund-detail template**; migrated via bulk import.

**C. Legal:** `/cit/terms-and-conditions` — "Matrix Terms of Service" (long legal text; mostly default content).

**Shared:** header/nav (simple 4-link MATRIX SOLUTIONS dropdown), footer (Matrix Trust + Matrix Solutions link groups, legal links, 4 social icons), and the "Talk to Us" contact form (present on all pages) rebuilt as one reusable author-editable block.

## Deliverable: Stakeholder Document
- **Format:** Editable **Markdown** in the repo (`docs/cit-migration-plan.md`) **and** a formatted **PDF**.
- **Plugin:** PDF generation uses the **project-management** plugin. You've approved enabling it; it will be written to `.agents/settings.json` as the first Execute-mode action.

## Estimating Basis & Assumptions
- Ideal engineering hours; **1 person-day = 8h**; ranges = low/high confidence.
- Migration via the project's page-import pipeline (scrape → analyze → map → generate HTML → preview) + bulk import for the fund pages.
- Shared blocks built once; core sibling pages reuse them. Fund pages driven by one template + parser/transformer, then bulk-imported and QA'd per page.
- Fidelity: visually faithful, responsive (600/900/1200), WCAG 2.1 AA, Lighthouse target 100.
- Contact form client-side only (submission endpoint out of scope).
- Excludes: net-new copywriting, brand/legal sign-off cycles, redesign beyond faithful migration.

## Effort Estimation Summary

**Group A — Foundation & shared blocks (build once)**
| # | Workstream | Low | High |
|---|-----------|----:|----:|
| 1 | Foundation & setup (dev server, branch, profile, recon) | 4 | 8 |
| 2 | Design system extraction (tokens, styles, fonts, colors) | 8 | 14 |
| 3 | Header/nav (simple 4-link dropdown, responsive, mobile) — *revised down* | 8 | 14 |
| 4 | Footer (2 link groups, social icons, legal) | 6 | 10 |
| 5 | Hero block + image/CTA variants | 8 | 12 |
| 6 | Cards block (feature + brochure/download variant) | 8 | 12 |
| 7 | Columns block (characteristics + "are/are not" + two-col lists) | 6 | 10 |
| 8 | Contact-form block/modal (fields, validation, success) | 10 | 16 |
| 9 | Offerings-grid block (22-item image cards + links) | 8 | 12 |
| 10 | Fund-detail page template + block(s) | 6 | 10 |
| | **Subtotal A** | **72** | **118** |

**Group B — Core 8 pages (content)**
| # | Workstream | Low | High |
|---|-----------|----:|----:|
| 11 | Landing page `/cit/` migration + refinement (reference) | 8 | 12 |
| 12 | 6 remaining sibling pages (~4–6h each) | 24 | 36 |
| 13 | matrix-cits page assembly (22-item grid data entry) | 4 | 8 |
| | **Subtotal B** | **36** | **56** |

**Group C — Fund detail pages (~22)**
| # | Workstream | Low | High |
|---|-----------|----:|----:|
| 14 | Bulk import infrastructure (parser/transformer) | 8 | 14 |
| 15 | 22 fund pages: bulk import + per-page QA (~1.5–2.5h each) | 33 | 55 |
| 16 | Fund-page assets (images, alt text) | 6 | 10 |
| | **Subtotal C** | **47** | **79** |

**Group D — Cross-cutting QA & delivery**
| # | Workstream | Low | High |
|---|-----------|----:|----:|
| 17 | Core-page assets (diagrams/images, optimize, alt) | 6 | 10 |
| 18 | Cross-page linking, metadata, content QA (~31 pages) | 6 | 12 |
| 19 | Accessibility + Lighthouse/PageSpeed tuning | 10 | 16 |
| 20 | Lint, code review, PR, Code Sync iterations | 6 | 10 |
| 21 | PM / coordination / clarifications buffer | 10 | 16 |
| | **Subtotal D** | **38** | **64** |

| Totals | Low (h) | High (h) | Person-days |
|---|---:|---:|---:|
| **Full site (A+B+C+D, ~30 content pages)** | **193** | **317** | **~24–40** |
| + Optional: terms-and-conditions page | 3 | 5 | 0.6 |
| + Stakeholder documentation (MD + PDF) | 2 | 4 | 0.5 |
| **Grand total** | **~198** | **~326** | **~25–41** |

**Headline estimate: ~24–40 person-days (~193–317h) for the full ~31-page `/cit/` site**, one engineer. With review/rework contingency: **~6–8 calendar weeks solo**, or **~3.5–4.5 weeks with two engineers** (blocks vs. content in parallel). *(The fund-detail pages, Group C, are ~25% of total effort and the main lever — sampling a few first de-risks the bulk line.)*

## Landing Page → Block Mapping (drives block build)
| Section | Content | Block |
|---------|---------|-------|
| Hero | Background image, H1, subhead | `hero` (image variant) |
| Definition | Heading + explanatory text | Default content |
| Contact CTA + form | Full Name, Country, Comments → "Contact Sales"; phone + FAQ | new **contact-form** block |
| Feature cards | "CIT Services" & "Matrix CITs" cards | `cards` |
| Characteristics | Traits list + "CITs are / are not" | `columns` + default content |
| Closing CTA | "Turn to the partner…" + image + button | `hero`/`columns` CTA variant |
| Header | Logo + nav + 4-link MATRIX SOLUTIONS dropdown + TALK TO US | `nav` doc + `header` block |
| Footer | 2 link groups + social icons + legal | `footer` doc + `footer` block |
| matrix-cits | 22 offering cards (image + internal link) | new **offerings-grid** block |
| cit-services | Downloadable brochure card | `cards` download variant |
| Fund pages (×22) | Per-fund detail content | new **fund-detail** template/block |
| Sibling pages | Diagram/process-flow visuals | Authored images (default content) |

## Delivery Phases & Milestones
- **M1 — Foundation & design system** (A: 1–2): setup, recon, tokens/global styles. *~2–3 days.*
- **M2 — Shared chrome & blocks** (A: 3–10): header, footer, hero, cards, columns, contact-form, offerings-grid, fund-detail template. *~9–13 days.*
- **M3 — Landing page reference** (B: 11, D: 17–18): `/cit/` matched to source. *~2–3 days.*
- **M4 — Core sibling pages** (B: 12–13): 6 pages + matrix-cits grid. *~4–6 days.*
- **M5 — Fund detail pages** (C: 14–16): infrastructure + bulk import of ~22 pages + QA. *~6–10 days.*
- **M6 — QA & delivery** (D: 19–21): accessibility, performance, lint, PR, Code Sync. *~3–4 days.*

## Risks & Contingencies
- **Fund-page homogeneity (largest risk)** — the ~22 fund pages are *assumed* to share one template. If layouts/tables/disclosures vary per fund, Group C grows. **Mitigation:** build the template against 2–3 sample fund pages first, then confirm the bulk estimate before committing.
- **Fund page count drift** — "22" is today's count; the grid may change. Re-count at build time.
- **Contact form backend** — client-side only; real submission endpoint (or AEM Adaptive Forms) is a separate estimate.
- **Legal/policy footer links** — source uses `javascript:void(0)`; real destinations needed or ship as placeholders.
- **Diagram images** — reused as authored images; rebuilding as native blocks would add effort.
- **Content/brand sign-off** — review cycles extend calendar time beyond engineering hours.

## Checklist

### Immediate actions (Execute mode) — enable plugin + create document
- [ ] Write `.agents/settings.json` with `{"enabledPlugins": {"project-management@excat-extended": true}}` to enable the project-management plugin.
- [ ] Save this artifact to `docs/cit-migration-plan.md` (editable Markdown source).
- [ ] After plugin loads (next message), generate the polished stakeholder **PDF** via the project-management skill.
- [ ] Confirm both files exist and share the PDF path with stakeholders.

### Estimation & approval
- [ ] Confirm effort estimate and full-site scope (~31 pages) with stakeholders.
- [ ] Approve approach for the 22 fund pages (template + bulk import; sample-first de-risking).
- [ ] Confirm contact-form backend expectation and design-fidelity bar.

### Phase 1 — Foundation & design system (M1)
- [ ] Start local dev server (`aem up`, background); confirm DA project type and preview/prod URLs.
- [ ] Create migration feature branch off `main`; verify migration profile targets `da-broadridge-cit`.
- [ ] Scrape landing page (content, metadata, images); confirm section boundaries.
- [ ] Extract design tokens (colors, fonts, spacing) into global styles.

### Phase 2 — Shared chrome & blocks (M2)
- [ ] Build header/nav (`nav` + `header`) with the simple 4-link MATRIX SOLUTIONS dropdown, responsive + mobile.
- [ ] Build footer (`footer`) with two link groups, social icons, legal links.
- [ ] Build `hero` block + image/CTA variants.
- [ ] Build `cards` block (feature + brochure/download variant).
- [ ] Build `columns` block (characteristics + two-column lists).
- [ ] Build **contact-form** block (fields, "Contact Sales" submit, success message, phone + FAQ).
- [ ] Build **offerings-grid** block (22 image cards + links).
- [ ] Build **fund-detail** template/block against 2–3 sample fund pages; confirm homogeneity + bulk estimate.
- [ ] Scope all block CSS; verify responsive at 600/900/1200.

### Phase 3 — Landing page reference (M3)
- [ ] Generate canonical `/cit/` HTML with metadata (Title/Description).
- [ ] Preview locally; compare against source; iterate to match.
- [ ] Download, optimize, and wire images (incl. diagrams) with alt text.

### Phase 4 — Core sibling pages (M4)
- [ ] Migrate `/cit/cit-services` (brochure download card).
- [ ] Migrate `/cit/matrix-cits` (assemble 22-item offerings grid).
- [ ] Migrate `/cit/broker-dealer-platform` (3 cards + diagram).
- [ ] Migrate `/cit/banks-and-trusts` (5-item list + diagram).
- [ ] Migrate `/cit/tpas-and-record-keepers` (bullet list + diagram).
- [ ] Migrate `/cit/financial-advisers` (two-column list).
- [ ] Migrate `/cit/about-us` (value-prop + solutions list + branding).

### Phase 5 — Fund detail pages (M5)
- [ ] Build bulk import infrastructure (parser/transformer) for the fund-detail template.
- [ ] Enumerate the full fund-page URL list (re-count vs. the 22 grid links).
- [ ] Bulk-import ~22 fund pages; QA each against source.
- [ ] Download/optimize fund-page assets; add alt text.
- [ ] (Optional) Migrate `/cit/terms-and-conditions` (long legal text).
- [ ] Verify all internal `/cit/...` links (nav, footer, grid → fund pages) resolve; keep social/external links absolute.

### Phase 6 — QA, performance & delivery (M6)
- [ ] Verify heading hierarchy, ARIA, alt text, WCAG 2.1 AA across all pages.
- [ ] Run `npm run lint` / `lint:fix` — clean.
- [ ] Run Lighthouse/PageSpeed on feature-preview URL; tune toward 100.
- [ ] Push branch; verify Code Sync, lint, perf via `gh pr checks`.
- [ ] Open PR to `main` with feature-preview links for `/cit/` and representative sibling + fund pages.

## Open Questions / Follow-ups
- **Fund-page template variance** — resolved after building the 2–3 samples; may adjust Group C.
- **Contact form submission target** — where "Contact Sales" posts; deferred pending decision.
- **Legal/policy footer destinations** — real URLs or placeholders.
- **Team size** — estimate assumes 1 engineer; two engineers roughly halve calendar time.

---
*Planning/estimation artifact — fact-checked across three re-scraping passes and self-critiqued (nav simplified, fund pages brought in scope). **This plan is execution-ready.** Enabling the plugin and creating the Markdown/PDF are file-writing steps that require **Execute mode** — switch modes and I'll perform them immediately in the order listed at the top.*
