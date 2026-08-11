/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: Broadridge (CIT / Divi) site-wide cleanup.
 *
 * Removes non-authorable Divi framework chrome, cookie consent, tracking
 * pixels, and inline script/style/iframe cruft so the import contains only
 * page-level authorable content. The shared header nav and footer are handled
 * separately as EDS chrome (nav/footer documents), NOT page content.
 *
 * Every selector below was verified against migration-work/cleaned.html.
 * NOTE: transformers run against the LIVE page during import/validation, so
 * generic tag removals (script/style/iframe/noscript/link) are included even
 * though the scraped snapshot has some of them commented out.
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

// Cleaned link text: strip the hidden "Opens in new window(PDF:KB)" spacer spans
// (display:none) the CIT site nests inside every document anchor, and collapse
// whitespace to a single line.
function cleanLinkLabel(a) {
  const clone = a.cloneNode(true);
  clone.querySelectorAll('[style*="display"]').forEach((n) => {
    if (/display\s*:\s*none/i.test(n.getAttribute('style') || '')) n.remove();
  });
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

// Build a clean <ul> of <li><a href>label</a></li> from a list of source anchors,
// preserving every href verbatim (PDF or external — e.g. goalpath rewrites two
// flat links to DocuSign at runtime). Anchors with no meaningful label are skipped.
function buildLinkList(anchors, doc) {
  const ul = doc.createElement('ul');
  anchors.forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    const label = cleanLinkLabel(a);
    if (!label) return;
    const na = doc.createElement('a');
    na.setAttribute('href', href);
    na.textContent = label;
    const li = doc.createElement('li');
    li.appendChild(na);
    ul.appendChild(li);
  });
  return ul.children.length ? ul : null;
}

/**
 * CIT fund-detail page normalization (guarded, backward-compatible).
 *
 * This runs on the "fund-detail" template pages (Mutual of America Stable Value,
 * Equity Armor, GoalPath, and the ~20 sibling fund pages). It is a hard NO-OP on
 * every other CIT page: the whole routine is gated on `section.divided-welcome`,
 * a wrapper that exists ONLY on fund-detail pages (verified absent on all eight
 * previously-migrated pages: cit-landing, matrix-cits, cit-services, about-us,
 * banks-and-trusts, broker-dealer-platform, financial-advisers, tpas-and-record-
 * keepers). Runs in beforeTransform so the NOTE relocation happens BEFORE the
 * hero parser replaces the hero <section> (which nests the NOTE band).
 *
 * Fund-detail source shape (all under #main-content):
 *   - section.et_pb_fullwidth_header_0 : hero (H1 fund name + optional subhead),
 *     with the risk-disclaimer NOTE nested inside as .et_pb_fullwidth_header_scroll.
 *   - section.divided-welcome : .left-side = <h3>-wrapped description paragraph(s);
 *     .right-side ul = flat document links (li>h4>a) + empty spacer <li>s.
 *   - section.blue-prints (0+, e.g. GoalPath ×2) : <h2> group heading + a
 *     .blueprint-links grid of per-sub-fund links (list-item>h4>span>a).
 *   - div.et_pb_section_1.welcomeSection (optional, GoalPath) : subadvisor <h1> +
 *     <h3>-wrapped blurb, plus a #disclaimer-notice popup (removed by cleanup).
 *   - section.CTA-line : closing CTA (parsed as columns).
 */
function normalizeFundPage(element) {
  const dividedWelcome = element.querySelector('section.divided-welcome');
  if (!dividedWelcome) return; // NOT a fund-detail page — no-op.
  const doc = element.ownerDocument;

  // 1. Relocate the risk-disclaimer NOTE out of the hero. The hero parser calls
  //    element.replaceWith(block) on the whole <section>, which would drop the
  //    NOTE band nested inside it. Lift its paragraphs into a plain default-content
  //    wrapper placed immediately after the hero (its own no-style section).
  const hero = element.querySelector('section.et_pb_fullwidth_header_0');
  const noteBand = hero && hero.querySelector('.et_pb_fullwidth_header_scroll');
  if (hero && noteBand) {
    const noteWrap = doc.createElement('div');
    noteWrap.className = 'fund-note';
    noteBand.querySelectorAll('p').forEach((p) => {
      if (!(p.textContent || '').replace(/\s+/g, ' ').trim()) return;
      const np = doc.createElement('p');
      np.innerHTML = p.innerHTML; // preserve inline <strong>/<i> emphasis
      noteWrap.appendChild(np);
    });
    if (noteWrap.children.length) hero.after(noteWrap);
    noteBand.remove();
  }

  // 2. Subadvisor "visit …" link (GoalPath) is an onclick-only DiviPopup trigger
  //    with no href; the real URL lives in the (about-to-be-removed)
  //    #disclaimer-notice popup's continue button. Promote it to a real href so
  //    the link survives as authorable content. Runs before the unwrap in step 3
  //    (which copies innerHTML) and before afterTransform removes the popup.
  const subLink = dividedWelcome.parentElement
    && dividedWelcome.parentElement.querySelector('div.et_pb_section_1.welcomeSection a[onclick]');
  if (subLink && !subLink.getAttribute('href')) {
    const popupLink = element.querySelector('#disclaimer-notice a[href^="http"]');
    if (popupLink) subLink.setAttribute('href', popupLink.getAttribute('href'));
    subLink.removeAttribute('onclick');
  }

  // 3. Unwrap Divi heading "styling" wrappers around body copy. The fund
  //    description (.left-side) and the subadvisor blurb are authored as a heading
  //    that CONTAINS <p> children — visual styling, not real headings. Replace each
  //    such wrapper with its non-empty <p> children so they become clean paragraphs.
  //    (Guard `querySelector('p')` leaves genuine headings — e.g. the subadvisor
  //    <h1>, which has no <p> child — untouched; that <h1> is demoted to <h2> by
  //    the generic h1 rule below.)
  const descScopes = [
    ...dividedWelcome.querySelectorAll('.left-side h1, .left-side h2, .left-side h3, .left-side h4'),
  ];
  const subSection = dividedWelcome.parentElement
    && dividedWelcome.parentElement.querySelector('div.et_pb_section_1.welcomeSection');
  if (subSection) {
    descScopes.push(...subSection.querySelectorAll('h3, h4'));
  }
  descScopes.forEach((h) => {
    if (!h.querySelector('p')) return;
    const frag = doc.createDocumentFragment();
    [...h.children].filter((c) => c.tagName === 'P').forEach((p) => {
      if (!(p.textContent || '').replace(/\s+/g, ' ').trim()) return;
      const np = doc.createElement('p');
      np.innerHTML = p.innerHTML;
      frag.appendChild(np);
    });
    if (frag.childNodes.length) h.replaceWith(frag); else h.remove();
  });

  // 4. Flatten the .right-side document list to a clean <ul> of links (drop hidden
  //    spacer spans and empty <li> placeholders; keep every real link, href verbatim).
  dividedWelcome.querySelectorAll('.right-side ul').forEach((ul) => {
    const anchors = [...ul.querySelectorAll(':scope > li a[href]')];
    const newUl = buildLinkList(anchors, doc);
    if (newUl) ul.replaceWith(newUl); else ul.remove();
  });
  dividedWelcome.querySelectorAll('.right-side small').forEach((s) => {
    if (!(s.textContent || '').trim()) s.remove();
  });

  // 5. Convert each grouped/nested document section (GoalPath) into a sub-heading
  //    (<h2>) + clean <ul> of links, preserving the per-series grouping, and
  //    consolidate all groups into the FIRST section.blue-prints wrapper. Keeping
  //    a single wrapper means the sections transformer (which resolves the section
  //    by the first `section.blue-prints` match) places its <hr> break + light-grey
  //    Section Metadata around the WHOLE grouped-documents section, with the
  //    metadata correctly at its end — every group lives in one EDS section.
  const blueprintSecs = [...element.querySelectorAll('section.blue-prints')];
  if (blueprintSecs.length) {
    const target = blueprintSecs[0];
    blueprintSecs.forEach((sec) => {
      const container = sec.querySelector('.blue-prints-container') || sec;
      const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
      const anchors = [...sec.querySelectorAll('.blueprint-links a[href]')];
      const frag = doc.createDocumentFragment();
      if (heading) {
        const text = (heading.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) {
          const h = doc.createElement('h2');
          h.textContent = text;
          frag.appendChild(h);
        }
      }
      const ul = buildLinkList(anchors, doc);
      if (ul) frag.appendChild(ul);
      if (sec === target) {
        sec.innerHTML = '';
        sec.appendChild(frag);
      } else {
        target.appendChild(frag);
        sec.remove();
      }
    });
  }
}

/**
 * CIT legal-page normalization (guarded, backward-compatible).
 *
 * Runs on the "legal" template (Matrix Terms of Service, /cit/terms-and-conditions).
 * It is a hard NO-OP on every other CIT page: the whole routine is gated on
 * `div.et_pb_text_inner-conditions`, a bespoke Divi text wrapper (note the
 * `-conditions` suffix; the standard Divi class is plain `et_pb_text_inner`) that
 * exists ONLY on the terms-and-conditions page. Runs in beforeTransform.
 *
 * Legal source shape (under #main-content):
 *   - section.et_pb_fullwidth_header_0 : hero (H1 "Matrix Terms of Service",
 *     background-image only, empty subhead) — parsed as hero-banner.
 *   - div.et_pb_section_1 : the full Terms body. A single
 *     div.et_pb_text_inner-conditions holds ~30 <p> elements. The ten section
 *     headings (Hyperlinks to Third-Party…, Matrix Company Does Not Provide…,
 *     Arbitration and Governing Law Provisions, Acceptable Use, Security/Privacy,
 *     Disclosure of User Information, Downtime and Interruptions in Service,
 *     Termination, Modification, General Provisions) are authored as bold-only
 *     paragraphs (`<p><strong>Title</strong></p>`), NOT real headings; the rest
 *     are body prose (with inline <strong> defined-terms and one /cit/matrix-cits
 *     link). All of it is DEFAULT CONTENT.
 *
 * This page has NO closing CTA (no section.CTA-line) and NO on-page Talk-to-Us
 * trigger — the #talk-to-us flyout present in the DOM is shared header chrome (a
 * body-level sibling of #main-header, so it escapes the header/footer removal in
 * afterTransform) and there is no form-contact block on the legal template to
 * consume it. Left in place, the sections transformer would relocate that raw
 * form widget into the page body, so we remove it here.
 */
function normalizeLegalPage(element) {
  const conditions = element.querySelector('div.et_pb_text_inner-conditions');
  if (!conditions) return; // NOT the legal page — no-op.
  const doc = element.ownerDocument;

  // 1. Drop the shared Talk-to-Us flyout chrome. Removing it BEFORE the sections
  //    transformer's beforeTransform (cleanup runs first) means that transformer's
  //    `#talk-to-us` relocation is a no-op, so the raw form widget never lands in
  //    the imported body. (On every other CIT page the flyout is consumed by the
  //    form-contact parser; this removal is guarded to the legal page only.)
  WebImporter.DOMUtils.remove(element, ['#talk-to-us']);

  // 2. Promote the bold-only "heading" paragraphs to real <h2> headings. A section
  //    heading is a <p> whose only meaningful content is a single <strong> (text
  //    outside <strong> is empty). Body paragraphs — which carry substantial text
  //    around their inline <strong> defined-terms — are left untouched, preserving
  //    the complete legal prose (and the /cit/matrix-cits link) as default content.
  [...conditions.querySelectorAll(':scope > p')].forEach((p) => {
    if (!p.querySelector('strong')) return;
    const clone = p.cloneNode(true);
    clone.querySelectorAll('strong').forEach((s) => s.remove());
    const outside = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    if (outside !== '') return; // has prose outside the bold — real body copy.
    const text = (p.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return; // empty spacer paragraph — leave for the generic cleanup.
    const h = doc.createElement('h2');
    h.textContent = text;
    p.replaceWith(h);
  });
}

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Cookie consent overlays (would block/obscure parsing).
    // cleaned.html L836 #onetrust-consent-sdk (wraps banner + preference-center + dark filter),
    // L839 #onetrust-banner-sdk, L1121 #ot-sdk-btn-floating (persistent floating cookie button).
    WebImporter.DOMUtils.remove(element, [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#ot-sdk-btn-floating',
    ]);

    // Fund-detail (CIT fund page) normalization. Guarded on section.divided-welcome
    // so it is a strict no-op on every other CIT page (verified above).
    normalizeFundPage(element);

    // Legal-page (Terms of Service) normalization. Guarded on
    // div.et_pb_text_inner-conditions so it is a strict no-op on every other CIT page.
    normalizeLegalPage(element);
  }

  if (hookName === TransformHook.afterTransform) {
    // Non-authorable site chrome + tracking + framework cruft.
    WebImporter.DOMUtils.remove(element, [
      // Shared header/footer chrome (migrated separately as nav/footer docs).
      '#main-header',          // cleaned.html L31 site header + top nav
      'header',                // defensive: any remaining header chrome
      'footer',                // cleaned.html L741 footer (also drops Ready-for-Next logo + stock-ticker arrow)
      // Utility "skip-link"/geolocation wrapper = body's first div child.
      // Per-page UUID id (snippet_<uuid>), so match by prefix for reuse across pages.
      'div[id^="snippet_"]',   // cleaned.html L26 wrapper
      '#geolocation',          // cleaned.html L27 geolocation data (defensive)
      // Tracking pixels/beacons (per-page numeric ids -> prefix match).
      '[id^="batBeacon"]',     // cleaned.html L1134 Bing UET beacon + pixel img
      // Inline scripts / styles / embeds (non-authorable framework cruft).
      'script',
      'noscript',
      'style',
      'link',
      'iframe',
    ]);

    // Empty disclaimer/consent popups that leak from the LIVE page. The Matrix
    // CITs welcome band nests an empty `#disclaimer-notice` popup (only an
    // "ACCEPT" button) that must not become authorable content. Remove the popup
    // wrappers wholesale; the real institutional-use disclaimer lives in
    // `#legal-notice` and is kept (its buttons are stripped below).
    WebImporter.DOMUtils.remove(element, [
      '#disclaimer-notice',    // empty consent popup nested in welcomeSection
      '#main-content > div.overlay', // dimming overlay for the popups
    ]);

    // The #legal-notice disclaimer is authorable body copy, but its DECLINE /
    // CONTINUE controls are cookie/consent buttons — drop them, keep the prose.
    element.querySelectorAll('#legal-notice .et_pb_button_module_wrapper, #legal-notice .et_pb_row_1')
      .forEach((n) => n.remove());

    // Remove stray consent/disclaimer controls that leak from the LIVE page
    // (e.g. an "ACCEPT" disclaimer button inside the welcomeSection popup, or a
    // "CONTINUE" button on the legal-notice popup). Interactive controls, not
    // authorable content.
    const CONTROL_TEXT = /^(i\s+)?(accept|decline|continue|agree|close|reject all|accept all)$/i;
    element.querySelectorAll('a, button, p, span, div').forEach((el) => {
      if (el.children.length > 0) return; // only leaf text nodes
      const txt = (el.textContent || '').trim();
      if (CONTROL_TEXT.test(txt)) el.remove();
    });

    // Brochure "download tile": a `a.box-cover` linking to a PDF (cit-services
    // `div.box-container` holds a single such tile pointing at
    // /cit/_assets/pdf/cit-brochure.pdf). It renders as a styled card in the
    // source but is authored most naturally as a plain default-content link.
    // Replace the whole tile with a `<p><a>` carrying the tile's heading text as
    // the label (dropping the decorative "Box Card" thumbnail and empty <h5>).
    // Guarded to PDF hrefs so it never touches the Matrix CITs offerings grid,
    // whose `a.box-cover` tiles link to fund pages AND are parsed into a cards
    // block before this afterTransform hook runs.
    element.querySelectorAll('a.box-cover[href$=".pdf"], a.box-cover[href*="/pdf/"]').forEach((a) => {
      const doc = element.ownerDocument;
      const href = a.getAttribute('href') || '';
      const labelSrc = a.querySelector('h1, h2, h3, h4, h5, h6') || a;
      const label = (labelSrc.textContent || '').replace(/\s+/g, ' ').trim() || 'Download';
      const link = doc.createElement('a');
      link.setAttribute('href', href);
      link.textContent = label;
      const p = doc.createElement('p');
      p.appendChild(link);
      a.replaceWith(p);
    });

    // Divi authors the CIT Services list as `<li><h3>item</h3></li>` (visual
    // styling, not real headings). Unwrap headings nested inside list items so
    // the list becomes plain default-content `<li>item</li>` text with correct
    // semantics. Block-owned lists (cards/columns) are parsed into block tables
    // before this hook, so only genuine default-content lists are affected.
    element.querySelectorAll('li h1, li h2, li h3, li h4, li h5, li h6').forEach((h) => {
      h.replaceWith(...h.childNodes);
    });

    // Drop junk/empty loose headings. The About Us intro band opens with a Divi
    // spacer heading — `<h3><p><span style="display:none">-</span></p></h3>` —
    // whose only text is a hidden dash. Left alone it renders as a stray "-"
    // heading. Remove any loose (non-block) heading whose visible text (ignoring
    // display:none descendants) is empty or pure punctuation. Block content lives
    // in <table>s at this stage, so `closest('table')` guards real block headings.
    const JUNK_HEADING = /^[\s \-–—•·.]*$/;
    element.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      if (h.closest('table')) return;
      const clone = h.cloneNode(true);
      clone.querySelectorAll('[style*="display"]').forEach((n) => {
        if (/display\s*:\s*none/i.test(n.getAttribute('style') || '')) n.remove();
      });
      const visible = (clone.textContent || '').replace(/ /g, ' ').trim();
      if (visible === '' || JUNK_HEADING.test(visible)) h.remove();
    });

    // Collapse nested-heading wrappers. The TPAs & Recordkeepers services band
    // wraps a real heading in an OUTER heading plus nested divs and a hidden "-"
    // spacer span:
    //   <h3><div>...<span style="display:none">-</span><h3>real text</h3>...</div></h3>
    // Serialized to markdown this becomes a broken "-### real text" heading. When
    // a (loose, non-block) heading is a pure wrapper — its own visible text
    // (excluding the nested heading and hidden spacers) is empty/punctuation —
    // replace it with a single clean heading at the OUTER level carrying the
    // inner heading's text. Legitimate headings never nest a heading, so this is
    // a no-op on the other CIT pages (whose spacer wraps a <p>, not a heading).
    element.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      if (h.closest('table')) return;
      const inner = h.querySelector('h1, h2, h3, h4, h5, h6');
      if (!inner) return;
      const ownClone = h.cloneNode(true);
      ownClone.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((n) => n.remove());
      ownClone.querySelectorAll('[style*="display"]').forEach((n) => {
        if (/display\s*:\s*none/i.test(n.getAttribute('style') || '')) n.remove();
      });
      const outerOwn = (ownClone.textContent || '').replace(/ /g, ' ').trim();
      if (outerOwn !== '' && !JUNK_HEADING.test(outerOwn)) return;
      const text = (inner.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const level = h.tagName.toLowerCase();
      const replacement = element.ownerDocument.createElement(level);
      replacement.textContent = text;
      h.replaceWith(replacement);
    });

    // Hero owns the page's only <h1>. Some CIT pages (e.g. About Us) mark an
    // in-body section heading ("A partner that can help you grow your business.")
    // as a second <h1>. Demote loose (non-block) <h1>s to <h2> so the imported
    // page has a single top-level heading. Two guards protect the hero <h1>:
    //   - After the hero parser runs it lives inside the hero block <table>
    //     (`closest('table')`), and
    //   - the still-loose source hero <h1> lives inside the fullwidth-header
    //     section (`closest('.et_pb_fullwidth_header')`) — so the demotion is
    //     safe whether or not the parsers have run yet (e.g. standalone
    //     transformer validation). On pages where a second heading was consumed
    //     into a Columns block the parser already demoted it, so this is a no-op.
    element.querySelectorAll('h1').forEach((h) => {
      if (h.closest('table') || h.closest('.et_pb_fullwidth_header')) return;
      const h2 = element.ownerDocument.createElement('h2');
      h2.innerHTML = h.innerHTML;
      h.replaceWith(h2);
    });

    // The source marks the CIT definition paragraph as an <h3> (visual styling,
    // not a real heading). It is long-form body copy — demote overly long
    // headings in the welcome/definition band to paragraphs for correct
    // semantics and heading hierarchy (hero owns the page's only <h1>/lead-in).
    element.querySelectorAll('h3, h4').forEach((h) => {
      const txt = (h.textContent || '').trim();
      // A "heading" longer than ~180 chars is prose, not a heading.
      if (txt.length > 180) {
        const p = element.ownerDocument.createElement('p');
        p.innerHTML = h.innerHTML;
        h.replaceWith(p);
      }
    });
  }
}
