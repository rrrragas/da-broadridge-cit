/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `hero-banner`.
 * Base block: hero (full-width banner variant).
 * Source: https://www.broadridge.com/cit/
 * Generated: 2026-08-11
 *
 * Library structure (1 column, 3 rows):
 *   Row 1 -> block name
 *   Row 2 -> background image (optional). The hero-banner decorator checks
 *            `:scope > div:first-child picture`; when absent it adds `.no-image`,
 *            so the image MUST be the first content row.
 *   Row 3 -> Title (heading) + Subheading.
 *
 * Source DOM (Divi fullwidth header): a `<section>` whose background is applied
 * two ways depending on where the parser runs:
 *   - live page: `style="background-image: url(/cit/_assets/.../img_herobg_cit.jpg)"`
 *     on the section (no <img> element).
 *   - scraped snapshot (migration-work/cleaned.html): a localized direct-child
 *     `<img src="./images/da374140c044e128fb805332f15ae69d.jpg">`.
 * Content lives in `.header-content`: `h1.et_pb_module_header` +
 * `span.et_pb_fullwidth_header_subhead`.
 */
export default function parse(element, { document }) {
  const cells = [];

  // Row 2: background image (optional). Prefer an explicit <img>; otherwise
  // synthesize one from the section's CSS `background-image` so the live page
  // (which has no <img>) still yields a background row.
  let bgImage = element.querySelector(':scope > img[src]') || element.querySelector('img[src]');
  if (!bgImage) {
    const styled = element.matches('[style*="background-image"]')
      ? element
      : element.querySelector('[style*="background-image"]');
    const style = styled ? styled.getAttribute('style') || '' : '';
    const match = style.match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
    if (match && match[2]) {
      let src = match[2].trim();
      try { src = new URL(src, document.baseURI).href; } catch (e) { /* keep as-is */ }
      bgImage = document.createElement('img');
      bgImage.src = src;
      bgImage.alt = 'Collective Investment Trusts';
    }
  }
  if (bgImage) cells.push([bgImage]);

  // Row 3: title + subheading.
  const heading = element.querySelector('h1.et_pb_module_header, .header-content h1, h1');
  const subhead = element.querySelector(
    '.et_pb_fullwidth_header_subhead, span[class*="subhead"], .header-content p',
  );

  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (subhead && subhead.textContent.trim()) {
    // Subhead is a bare <span> in source; wrap in a paragraph so it renders as
    // additional text below the heading rather than inline with it.
    const p = document.createElement('p');
    p.textContent = subhead.textContent.replace(/\s+/g, ' ').trim();
    contentCell.push(p);
  }

  // Empty-block guard: nothing meaningful to render.
  if (!bgImage && contentCell.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  if (contentCell.length) cells.push([contentCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-banner', cells });
  element.replaceWith(block);
}
