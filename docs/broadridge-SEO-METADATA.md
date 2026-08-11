# SEO & Metadata Standards — Broadridge CIT

SEO parity is a primary success metric for the migration (see the EDS Playbook and the Solution Design
Document). This defines the metadata every page must carry, plus canonical, hreflang, and structured-data
conventions. Rules: [broadridge-EDS-RULES.md §6](broadridge-EDS-RULES.md).

## Page metadata schema

Authored in the **Metadata** block/section of each document (DA) or page properties (UE). Required unless noted.

| Field | Required | Notes |
|---|---|---|
| `title` | ✓ | ≤ 60 chars; unique per page; primary keyword near the front. |
| `description` | ✓ | 120–160 chars; unique; compelling. |
| `keywords` | – | Optional; comma-separated. |
| `author` | – | For articles/press releases. |
| `publish-date` | – | ISO `YYYY-MM-DD`; articles. |
| `image` | ✓* | OG/social share image; *required for pages that get shared. |
| `og:title` / `og:description` | – | Default to `title`/`description` if omitted. |
| `canonical` | ✓ | See below. |
| `robots` | – | `index,follow` default; set `noindex` only deliberately. |

Keep the set consistent across templates so the query index and social previews stay uniform.

## Canonical URLs
- Every page has a canonical. Default is the page's own clean URL.
- Use canonical to consolidate duplicates (e.g. tracking-param variants) to the clean URL.
- Canonical + all metadata must be present in the **first-pass server markup** (no JS needed) — verify with
  `curl -s <url> | grep -i canonical`.

## Multilingual / hreflang
- Locale in the path: `/en/…`, `/ar/…` (ISO codes).
- Provide reciprocal `hreflang` links between locale variants, plus `x-default`.
- RTL locales (Arabic/Hebrew): see the `broadridge-i18n-rtl` skill for layout; SEO-wise they follow the same rules.

## Structured data (JSON-LD)
- Emit `application/ld+json` for pages where it helps: `Organization` (home), `BreadcrumbList`, `Article`
  (news/insights), `FAQPage`, `Product` if applicable.
- Generate it from page content in a block or in `scripts.js`; validate with Google's Rich Results Test and
  the Schema.org validator.
- Keep JSON-LD consistent with visible content (no cloaking).

## Sitemap & robots
- `robots.txt` and sitemaps are configured in the EDS Config Service (Admin API), not committed here.
  Confirm crawl-allowed/blocked paths per environment before go-live.
- Preview/non-prod hosts (`*.aem.page`) must not be indexed.

## Verification checklist (per template)
- [ ] `title`, `description`, `canonical`, share `image` present in `curl` output (no JS).
- [ ] Canonical points to the clean production URL.
- [ ] hreflang reciprocal + `x-default` for localized pages.
- [ ] JSON-LD validates and matches visible content.
- [ ] `noindex` only where intended; preview hosts not indexed.
