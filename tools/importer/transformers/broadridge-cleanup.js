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
