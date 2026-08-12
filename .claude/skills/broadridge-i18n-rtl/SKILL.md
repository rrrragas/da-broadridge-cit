---
name: broadridge-i18n-rtl
description: "Use this when a Broadridge CIT block or page renders user-facing text, formats dates/numbers/currency, or must support multiple locales or right-to-left (RTL) languages such as Arabic or Hebrew. Covers placeholders instead of hardcoded strings, camelCase keys, the Intl API, ISO locale URLs, and CSS logical properties for RTL mirroring."
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Internationalization & RTL

Apply whenever code produces user-facing text or layout that must adapt across locales. Rules and sources are
in [docs/broadridge-EDS-RULES.md](../../../docs/broadridge-EDS-RULES.md) §7.

## Text — never hardcode

- [ ] No user-facing string literals in JS/CSS. Pull labels from placeholders with a sensible fallback.
- [ ] Placeholder keys are **camelCase** and contextual: `readMoreLabel`, `formSubmitError` — not `label1`.
- [ ] A missing placeholder degrades to the fallback, never to a blank or a raw key.

This repo's `scripts/aem.js` does **not** ship a `fetchPlaceholders` helper, so fetch the locale's
`placeholders.json` (an EDS sheet) directly and cache it. Add a shared helper in `scripts/scripts.js` rather
than refetching per block.

```js
// e.g. in scripts/scripts.js — cache across blocks
const phCache = {};
export async function getPlaceholders(prefix = 'default') {
  if (!phCache[prefix]) {
    const path = prefix === 'default' ? '/placeholders.json' : `/${prefix}/placeholders.json`;
    const resp = await fetch(path);
    const { data } = resp.ok ? await resp.json() : { data: [] };
    phCache[prefix] = Object.fromEntries(data.map(({ Key, Text }) => [toCamelCase(Key), Text]));
  }
  return phCache[prefix];
}

// in a block: locale prefix drives which sheet loads (e.g. 'en', 'ar')
const ph = await getPlaceholders(locale);
const label = ph.readMoreLabel || 'Read more';
```

## Locales & URLs

- [ ] Locale paths use ISO codes: `/en/`, `/ar/`, `/de/`. Region matters where it changes formatting
      (`en-US` vs `en-GB`).
- [ ] Detect locale from the document/path; don't assume the default.

## Formatting — use `Intl`

- [ ] Dates via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`, currency via
      `Intl.NumberFormat(locale, { style: 'currency', currency })`.
- [ ] Never hand-roll date/number/currency strings.

```js
const price = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(1999.5);
const when = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
```

## RTL

- [ ] Layout that must mirror uses **CSS logical properties**: `margin-inline-start`, `padding-inline-end`,
      `inset-inline`, `text-align: start` — never physical `left`/`right`, `margin-left`, etc.
- [ ] Icons/chevrons that imply direction flip in RTL (via logical positioning or `[dir="rtl"]` overrides).
- [ ] Test at least one RTL locale (Arabic) — check bidi text, alignment, and mirrored spacing.
- [ ] Physical `left`/`right` is acceptable only for things that must NOT mirror (e.g. a brand logo pinned
      to a fixed corner) — call that out in review.

## Checklist before PR

- [ ] No hardcoded user-facing text.
- [ ] All formatting goes through `Intl`.
- [ ] Logical properties used for mirrored layout; verified in an RTL locale.

## Related skills

- `broadridge-block-review` — overall block self-review.
- `content-modeling` — where authored text vs. placeholder text belongs.
