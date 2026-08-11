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

    // Remove stray consent/disclaimer controls that leak from the LIVE page
    // (e.g. an "ACCEPT" disclaimer button inside the welcomeSection popup).
    // These are interactive controls, not authorable content.
    const CONTROL_TEXT = /^(i\s+)?(accept|decline|agree|close|reject all|accept all)$/i;
    element.querySelectorAll('a, button, p, span, div').forEach((el) => {
      if (el.children.length > 0) return; // only leaf text nodes
      const txt = (el.textContent || '').trim();
      if (CONTROL_TEXT.test(txt)) el.remove();
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
