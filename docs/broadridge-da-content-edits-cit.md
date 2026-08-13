# DA content edits — /cit follow-ups

Three content changes that live in **Document Authoring** (da.live), not in the code repo
(`content/` is a local mirror and is gitignored). Apply each in the DA document editor, or via the
import pipeline. Each edit lists the **author action** (what to do in the DA editor) and the
**resulting HTML** (what the plain.html should look like after), so either path is unambiguous.

Verified against the live source (`https://www.broadridge.com/cit/`) on desktop/tablet/mobile.

---

## Edit 1 — In-body "TALK TO US" CTA → blue button (parity fix)

**Where:** `/cit`, the columns section headed *"Turn to the partner that can help you grow your
business."* (just above the Talk-to-us form block).

**Problem:** the CTA is authored as a plain link, so it renders as plain blue text. The source
renders a **filled blue button** (`background #0050ae`, white text, 2px radius, weight 700, padding
`15px 27px`).

**Why bold fixes it:** EDS `decorateButtons` (scripts.js) promotes a *standalone, emphasized* link to
a button — `**bold**` → `a.button.primary`, which is already styled blue/white/2px/700 in
`styles.css`. No CSS change needed; it's purely an authoring change.

**Author action (DA editor):**
1. Select the `TALK TO US` link text.
2. Make it **bold** (Cmd/Ctrl-B). It must remain the only content in its paragraph.
3. (Recommended) Point the link at the contact form instead of `/` — e.g. the form section anchor —
   so the CTA reaches the form rather than the homepage.

**Resulting HTML (plain.html):**
```html
<!-- before -->
<p><a href="/">TALK TO US</a></p>

<!-- after -->
<p><strong><a href="/cit#talk-to-us">TALK TO US</a></strong></p>
```

> Note the `href`: today it's `/` (homepage). `#talk-to-us` targets the form only if the form block
> carries that id; otherwise link to the form page/section the author intends. The **bold** is the
> parity fix; the href is a correctness improvement.

---

## Edit 2 — Remove the duplicate header "TALK TO US" (outside the nav menu)

**Where:** the **nav** document (`/nav`).

**Problem:** the source header shows **one** `TALK TO US` (the last item of the nav menu). The
migration renders **two** — the extra one is a standalone entry that sits in its own top-level block
**outside** the nav menu list, so EDS places it in the nav `tools` slot. That's the duplicate to
remove.

**Author action (DA editor):** in the nav document, delete the **trailing standalone** "TALK TO US"
paragraph — the one *after* the main navigation list. Keep the "TALK TO US" that is the **last item
of the nav menu list** (that one matches the source's position and styling).

**Resulting HTML (nav.plain.html):**
```html
<!-- KEEP — last item inside the nav menu list -->
    <li>
      <p><a href="/">TALK TO US</a></p>
    </li>
  </ul></div>

<!-- REMOVE — the standalone third top-level div (renders in the nav-tools slot) -->
<div><p><a href="/">TALK TO US</a></p></div>
```

After removal the nav fragment has **two** top-level `<div>`s (brand, menu-list) instead of three;
the header then shows a single `TALK TO US`, matching the source.

> If the intent was the *opposite* (a right-aligned tools CTA), keep the standalone div and remove the
> in-list `<li>` instead — but the source puts it in the menu, so removing the standalone is the
> source-faithful choice.

---

## Edit 3 — Publish the re-migrated footer + logo to DA

The footer was re-migrated locally (logo + company description recovered, ticker excluded, social
icons, dark sub-bar). Those live in the gitignored `content/footer.plain.html` + `content/images/`,
so they must be **published to DA** to go live — the `blocks/footer/*` code is already committed.

**Steps:**
1. **Upload the logo** to DA media (Media Bus): `content/images/rfn-knockout.png` → the footer
   document's image, `alt="Ready for Next"`.
2. **Update the footer document** to the re-migrated structure:
   - a brand-intro band: the **Ready-for-Next logo** + the company-description paragraph
     ("Broadridge is a global technology leader…"), ticker text **excluded** (dynamic data);
   - the existing link groups (Matrix Trust, Matrix Solutions), social links, copyright, legal —
     unchanged.
3. **Preview + publish** the footer document.

**DA Source API (reference — credentials injected server-side, no token in-chat):**
```bash
# logo binary
curl -X POST -F "data=@content/images/rfn-knockout.png;type=image/png" \
  "https://admin.da.live/source/<org>/<repo>/cit/images/rfn-knockout.png"

# footer document
curl -X POST -F "data=@content/footer.plain.html;type=text/html" \
  "https://admin.da.live/source/<org>/<repo>/footer.html"
```
Replace `<org>/<repo>` with the site's DA content source. Then trigger DA preview/publish for
`/footer`.

---

## After applying — re-verify

Run the generic comparator to confirm each fix landed (source-faithful, no new drift):
```bash
npm run broadridge:compare -- --page /cit                 # button no longer a plain link; one nav CTA
npm run broadridge:compare -- --source-selector footer --dest-selector footer --path /cit
```
Expected: the `TALK TO US` style-drift row clears, the header shows a single CTA, and the footer
missing-content rows (logo/description) resolve on the published side.
