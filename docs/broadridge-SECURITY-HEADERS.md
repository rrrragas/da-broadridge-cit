# Security Headers & CSP — Broadridge CIT

This project already ships a Content-Security-Policy. This document explains what's there, how to extend it
safely, and how client code is kept in line. Rules: [broadridge-EDS-RULES.md §4](broadridge-EDS-RULES.md). Enforcement:
`npm run broadridge:check:security`.

## The current CSP (in `head.html`)

```
script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:;
base-uri 'self';
object-src 'none';
frame-src 'self' https:;
require-trusted-types-for 'script';
```

It is delivered via a `<meta http-equiv="Content-Security-Policy" … move-to-http-header="true">` tag. The
`move-to-http-header` attribute tells the EDS pipeline to promote this meta into a real HTTP response header
at the edge (stronger than a meta tag). Both `aem.js` and `scripts.js` are loaded with `nonce="aem"`.

What each directive does:

| Directive | Effect |
|---|---|
| `script-src 'nonce-aem' 'strict-dynamic' …` | Only scripts with the `aem` nonce run; `strict-dynamic` lets those trusted scripts load further scripts (how blocks dynamically import their JS). |
| `base-uri 'self'` | Prevents `<base>` hijacking. |
| `object-src 'none'` | Blocks `<object>`/`<embed>`/Flash-style plugins. |
| `frame-src 'self' https:` | Iframes only from self or https origins. |
| `require-trusted-types-for 'script'` | Enables Trusted Types — blocks raw string → DOM sink assignments unless a policy is used. **This is why unsanitized `innerHTML` is risky here**, not just as a style rule. |

## Extending the CSP

Add the **narrowest** directive that unblocks the need, then test:

- Calling an external API from a block (e.g. the `widget` block `fetch`) → add `connect-src` with the exact
  origin(s): `connect-src 'self' https://api.example.com;`
- External images (Media Bus is same-origin, but a third-party image host is not) → `img-src`.
- Embedding a specific vendor iframe → tighten `frame-src` to that origin rather than blanket `https:`.
- Fonts/styles from a CDN → `font-src` / `style-src`.

Never add `'unsafe-eval'`. Never broaden `object-src`. If a library needs `eval`, replace the library.

## Where headers are configured

- **Page-level CSP:** the `head.html` meta above (git-tracked).
- **Site-level response headers** (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CORS, cache-control):
  the EDS Config Service `headers` property, managed via the **Admin API** — not committed to git. See
  https://www.aem.live/docs/admin.html and https://www.aem.live/docs/custom-headers. Coordinate changes with
  the architect; document the intended header set in the Solution Design Document.
- **Trusted Types policy:** if a block genuinely must set HTML, define and use a Trusted Types policy rather
  than disabling `require-trusted-types-for`.

## How client code is kept safe

`npm run broadridge:check:security` (part of `broadridge:check`, and CI) scans `blocks/**/*.js` and `scripts/*.js`:

- **Fails** on `eval`, `new Function`, `document.write`, and `javascript:`/`vbscript:` URL literals.
- **Warns** on `innerHTML`/`outerHTML`/`insertAdjacentHTML` (used today in `widget`, `fragment`, `header`) —
  prefer `createElement`/`textContent`; if HTML injection is unavoidable, keep the source trusted/first-party
  and consider a Trusted Types policy.

Use `isSafeUrl()` from [`scripts/broadridge-utils.js`](../scripts/broadridge-utils.js) to validate any author-supplied URL before
using it as an `href`/`src`.
