I'll analyze the target site and build a migration plan. Let me start by gathering information.Let me examine the existing migration config and project structure, and fetch the target page.Let me inspect the repo to determine project type and available blocks, and gather more detail on the page.Let me look at existing blocks, content, and any prior migration work.Let me examine existing content, blocks, and the migration profile to understand the current state.Let me determine the project type and check the source page's rendered detail more thoroughly.I have enough understanding of the source page and repo. Two decisions materially change the plan, so let me confirm them before finalizing.# Broadridge CIT Section — EDS Migration Plan

## Objective
Migrate the Broadridge Collective Investment Trusts website section (`https://www.broadridge.com/cit/`) — the landing page plus its 7 sibling pages — into this AEM Edge Delivery Services (Document Authoring) project as canonical, author-editable EDS content. Recreate the shared header navigation and footer, and rebuild the "Talk to Us" contact modal as a lightweight, author-editable EDS block.

## Scope (confirmed)
- **Full `/cit/` section** — 8 pages total:
  1. `/cit/` — Home / landing (primary reference page)
  2. `/cit/cit-services` — CIT Services
  3. `/cit/matrix-cits` — Matrix CITs
  4. `/cit/broker-dealer-platform` — Broker-Dealers
  5. `/cit/banks-and-trusts` — Banks & Trusts
  6. `/cit/tpas-and-record-keepers` — TPAs & Recordkeepers
  7. `/cit/financial-advisers` — Financial Advisers
  8. `/cit/about-us` — About Us
  9. (+ `/cit/terms-and-conditions` — Matrix Terms of Service, footer-linked; treat as optional 9th page)
- **Shared header navigation** (logo, HOME, CIT SERVICES, MATRIX CITs, MATRIX SOLUTIONS dropdown → Broker-Dealers / Banks & Trusts / TPAs & Recordkeepers / Financial Advisers, ABOUT US, TALK TO US).
- **Shared footer** (link groups + Facebook/Twitter/LinkedIn/YouTube social icons + legal links).
- **Contact form** rebuilt as a **simple author-editable EDS block/fragment** (fields: Full Name, Country dropdown, Comments; submit label "Contact Sales"; success message). No AEM Adaptive Form tooling.

## Current State (verified)
- Repo is an AEM boilerplate, **Document Authoring (DA) project** — no `fstab.yaml`, no Universal Editor `component-*.json` files; content lives as `content/*.plain.html`.
- GitHub: `rrrragas/da-broadridge-cit`, branch `main`. Preview org/site: `rrrragas` / `da-broadridge-cit`.
- Existing blocks: `cards`, `columns`, `footer`, `fragment`, `header`, `hero`, `widget` (custom `widget` loader present).
- `content/` currently holds boilerplate placeholder content (`index.plain.html`, `nav.plain.html`, `footer.plain.html`) that will be replaced.
- Preview URLs: `https://main--da-broadridge-cit--rrrragas.aem.page/` (preview) / `.aem.live/` (production).

## Source Landing Page Structure (mapped to blocks)
| # | Section | Content | Proposed EDS treatment |
|---|---------|---------|------------------------|
| 1 | Hero | Background image (abstract digital), H1 "Collective Investment Trusts", subhead "A cost-effective approach to diversified investment portfolios" | `hero` block (image variant) |
| 2 | Definition | Heading + explanatory paragraphs (institutional-only investment structure) | Default content (headings/text) |
| 3 | Contact CTA + form | "Talk to Us" modal (Full Name, Country, Comments → "Contact Sales"), Matrix support phone + FAQ link | New **contact-form** block/fragment |
| 4 | Two feature cards | "CIT Services" & "Matrix CITs" clickable cards linking to sibling pages | `cards` block |
| 5 | Characteristics | Heading + key-traits bullet list + "CITs are" vs "CITs are not" comparison | `columns` block (two lists) + default content |
| 6 | Closing CTA | "Turn to the partner that can help you grow your business" + image + "TALK TO US" button | `hero`/`columns` CTA variant with button |
| — | Header | Logo + nav + MATRIX SOLUTIONS dropdown + TALK TO US | `nav` document + `header` block (may need dropdown support) |
| — | Footer | Link groups + social icons + legal links | `footer` document + `footer` block |

*(Sibling pages will be analyzed individually during import; they reuse the same header/footer and largely the same block palette — cards, columns, hero, default content — with per-page content.)*

## Migration Approach
Use the project's page-import pipeline (scrape → analyze structure → map to blocks → generate canonical HTML → preview) driven by the migration skills, rather than hand-writing HTML. The `/cit/` landing page is migrated and refined first as the reference; the remaining pages follow the same template. Shared nav/footer are instrumented once and reused across all pages.

## Checklist

### Phase 0 — Setup & confirmation
- [ ] Confirm project type (DA) and preview/prod URLs; start the local dev server (`aem up`, background) at `http://localhost:3000`.
- [ ] Verify the migration profile (`migration-work/profile.json`, `.migration/project.json`) points at site `da-broadridge-cit`.
- [ ] Establish a working feature branch off `main` for the migration.

### Phase 1 — Landing page (`/cit/`) as reference
- [ ] Scrape `https://www.broadridge.com/cit/` (content, metadata, images) via the page-import pipeline.
- [ ] Analyze page structure; confirm section boundaries and block mapping (hero, definition text, contact form, cards, characteristics/columns, closing CTA).
- [ ] Survey existing block palette; decide reuse vs. new blocks (see Phase 4).
- [ ] Generate canonical import HTML for `/cit/` (`content/index.plain.html`), including metadata (Title, Description).
- [ ] Preview locally and compare against the source page; fix layout/content gaps.

### Phase 2 — Shared navigation & footer
- [ ] Rebuild `content/nav.plain.html` with the CIT header: logo, top-level links, and MATRIX SOLUTIONS dropdown (Broker-Dealers, Banks & Trusts, TPAs & Recordkeepers, Financial Advisers), plus TALK TO US.
- [ ] Extend the `header` block if needed to support the multi-level dropdown menu.
- [ ] Rebuild `content/footer.plain.html`: link groups (Matrix Trust, Matrix Solutions, legal), plus social icons (Facebook, Twitter, LinkedIn, YouTube).
- [ ] Point all internal nav/footer links at the migrated `/cit/...` paths; keep external/social links absolute.
- [ ] Preview header + footer rendering across viewports (mobile/tablet/desktop).

### Phase 3 — Sibling pages (×7, +1 optional)
- [ ] Migrate `/cit/cit-services`.
- [ ] Migrate `/cit/matrix-cits`.
- [ ] Migrate `/cit/broker-dealer-platform`.
- [ ] Migrate `/cit/banks-and-trusts`.
- [ ] Migrate `/cit/tpas-and-record-keepers`.
- [ ] Migrate `/cit/financial-advisers`.
- [ ] Migrate `/cit/about-us`.
- [ ] (Optional) Migrate `/cit/terms-and-conditions`.
- [ ] For each: scrape → analyze → map to shared block palette → generate HTML → preview → verify internal links resolve within the section.

### Phase 4 — Blocks & contact form
- [ ] Build the **contact-form** block/fragment (Full Name, Country dropdown, Comments; "Contact Sales" submit; success message; support phone + FAQ link). Author-editable content model; client-side only (no backend submit tooling in this pass — note where submissions would post).
- [ ] Add/adjust the `hero` variant for background-image + CTA-button treatments.
- [ ] Confirm `cards` and `columns` blocks render the feature cards and characteristics/comparison lists; add variants only if needed.
- [ ] Enhance `header` block for the dropdown if not already covered in Phase 2.
- [ ] Scope all new CSS to the block; follow mobile-first responsive rules (600/900/1200 breakpoints).

### Phase 5 — Assets & content QA
- [ ] Download, optimize, and place page images; ensure all `img` have alt text and correct `loading` attributes.
- [ ] Verify heading hierarchy, ARIA, and WCAG 2.1 AA basics on each page.
- [ ] Confirm metadata (Title/Description) per page; no leftover boilerplate placeholder content remains.
- [ ] Cross-check every internal link across all 8–9 pages resolves; social/legal links behave as on source.

### Phase 6 — Validation, performance & delivery
- [ ] Run `npm run lint` (and `lint:fix`) — clean.
- [ ] Visually critique migrated pages vs. the original (block/section/page level); iterate on gaps.
- [ ] Run PageSpeed/Lighthouse against the feature-preview URL; target 100 and fix regressions.
- [ ] Push the feature branch; verify AEM Code Sync, lint, and perf checks via `gh pr checks`.
- [ ] Open a PR to `main` with a feature-preview link to `/cit/` (and note sibling pages) in the description.

## Open Questions / Assumptions
- **Contact form submission target:** rebuilt as a client-side author-editable block for now; where submissions should POST is out of scope this pass (flag for follow-up).
- **Policy/legal footer links** (`javascript:void(0)` on source) will be rendered as placeholder/non-navigating links unless real destinations are provided.
- **Image hosting:** page images will be committed optimized and/or authored via DA media; source CDN URLs will be replaced.
- **Content publishing to DA:** generating and previewing HTML locally is in scope; uploading/publishing to Document Authoring (admin.da.live) is a delivery step that requires the DA credential opt-in to be enabled in Settings.

---
*This is a planning artifact. Execution (scraping, generating content, creating/modifying blocks, and any file changes) requires switching to Execute mode.*
