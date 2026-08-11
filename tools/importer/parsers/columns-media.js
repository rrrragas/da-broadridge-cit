/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `columns-media`.
 * Base block: columns (text column beside an image column).
 * Source: https://www.broadridge.com/cit/
 * Generated: 2026-08-11
 *
 * Library structure: multiple columns/rows; column count = visual grouping.
 * Here every instance is a single row with 2 columns: TEXT | IMAGE.
 *
 * Two shapes handled (both text-left, image-right):
 *   A) Characteristics (`.et_pb_row_2`): text column = H1 lead-in + H3 intro
 *      ("...They are:") + a 5-item bullet list (each source <li> wraps an <h3>);
 *      image column = "CITs Characteristics" photo.
 *   B) Closing CTA (`.et_pb_row_5`): text column = H1 + a body paragraph
 *      (source wraps the <p> inside an <h3>) + a "TALK TO US" button; image
 *      column = "Broadridge employees..." photo.
 *
 * Normalization: source H1s are demoted to H2 (the hero owns the page H1);
 * headings that wrap block-level content (Divi's <h3><p>…</p></h3>) are unwrapped
 * to their body content; the bullet list's per-<li> <h3> wrappers are flattened
 * to plain list text; the CTA button is emitted as a lone link (EDS decorates a
 * standalone link as a button).
 */

function buildList(srcList, document) {
  const tag = srcList.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul';
  const list = document.createElement(tag);
  [...srcList.querySelectorAll(':scope > li')].forEach((li) => {
    const text = li.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const nli = document.createElement('li');
    nli.textContent = text;
    list.appendChild(nli);
  });
  return list.children.length ? list : null;
}

// Push a cleaned copy of a source node into `out`, normalizing Divi cruft.
function pushCleaned(node, document, out) {
  const tag = (node.tagName || '').toLowerCase();
  if (!tag) return;

  if (tag === 'ul' || tag === 'ol') {
    const list = buildList(node, document);
    if (list) out.push(list);
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    // Divi sometimes wraps body copy / lists inside a heading — unwrap those.
    if (node.querySelector('p, div, ul, ol')) {
      [...node.children].forEach((c) => pushCleaned(c, document, out));
      return;
    }
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const level = tag === 'h1' ? 'h2' : tag; // demote page-level H1 to H2
    const h = document.createElement(level);
    h.textContent = text;
    out.push(h);
    return;
  }

  if (tag === 'p') {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      out.push(p);
    }
    return;
  }

  if (tag === 'div') {
    [...node.children].forEach((c) => pushCleaned(c, document, out));
  }
}

function collectTextColumn(col, document) {
  const out = [];
  const inners = [...col.querySelectorAll('.et_pb_text_inner')];
  const scopes = inners.length ? inners : [col];
  scopes.forEach((inner) => {
    [...inner.children].forEach((node) => pushCleaned(node, document, out));
  });

  // CTA button (outside the text modules). Emit as a lone link so EDS button
  // decoration styles it; javascript:/# hrefs point to the on-page contact form.
  const btn = col.querySelector('a.et_pb_button, a.open-talk-to-us, .et_pb_button_module_wrapper a[href]');
  if (btn) {
    const label = btn.textContent.replace(/\s+/g, ' ').trim();
    if (label) {
      let href = btn.getAttribute('href') || '';
      if (!href || href === '#' || /^javascript:/i.test(href)) href = '#talk-to-us';
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      const p = document.createElement('p');
      p.appendChild(a);
      out.push(p);
    }
  }

  return out;
}

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > .et_pb_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.et_pb_column')];

  const textCell = [];
  let imageEl = null;

  columns.forEach((col) => {
    const img = col.querySelector('img[src]');
    if (img && !imageEl) {
      imageEl = img; // image column
    } else if (!img) {
      textCell.push(...collectTextColumn(col, document));
    }
  });

  // Empty-block guard.
  if (!textCell.length && !imageEl) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // One row, 2 columns: text | image. Pad a missing side to keep 2 columns.
  const row = [textCell.length ? textCell : '', imageEl || ''];
  const cells = [row];

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-media', cells });
  element.replaceWith(block);
}
