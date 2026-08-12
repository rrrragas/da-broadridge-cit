/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `cards`. Two variants, selected by the source DOM:
 *
 *   - "feature" (text-only clickable tiles) — Divi welcome section
 *     `.et_pb_row_1.et_pb_equal_columns`: two `.et_pb_column`s, each wrapping
 *     content in an anchor. Follows the EDS "Cards (no images)" convention:
 *     each card = ONE cell (heading title wrapped in the card link + paragraph).
 *     Source: https://www.broadridge.com/cit/
 *
 *   - "offerings" (image-thumbnail product grid) — the Matrix CITs offerings
 *     grid `div.box-container` holding `div.sextion-boxes > a.box-cover` tiles.
 *     Follows the EDS "Cards" (with images) 2-column convention: each card = a
 *     row of [image cell, text cell]. The text cell carries the title heading
 *     wrapped in the tile link (so the cards decorator makes the whole tile
 *     clickable) plus the optional subadvisor line as a paragraph.
 *     Source: https://www.broadridge.com/cit/matrix-cits
 *
 * `createBlock` adds the block-name/variant header row itself; do NOT seed one
 * here or the variant label leaks in as an extra card row.
 */

function cleanText(node) {
  return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

/**
 * "offerings" variant: `div.box-container` with `a.box-cover` tiles.
 * Each tile: img[alt="Box Card"] + <h3> title + optional <h5> subadvisor,
 * linking to /cit/<slug>.
 */
function parseOfferings(element, tiles, document) {
  const cells = [];

  tiles.forEach((tile) => {
    const href = tile.getAttribute('href') || '';
    const srcImg = tile.querySelector('img[src]');
    const title = cleanText(tile.querySelector('h3'));
    const subadvisor = cleanText(tile.querySelector('h5'));
    if (!title && !srcImg) return;

    // Cell 1: image. Preserve the real thumbnail src (relative) so WebImporter's
    // adjustImageUrls resolves it against the page URL. Use the fund title as alt
    // for accessibility (source alt is a generic "Box Card").
    let imgCell = '';
    if (srcImg) {
      const img = document.createElement('img');
      img.setAttribute('src', srcImg.getAttribute('src'));
      img.setAttribute('alt', title || srcImg.getAttribute('alt') || '');
      imgCell = img;
    }

    // Cell 2: title heading (wrapped in the tile link) + optional subadvisor.
    const textCell = [];
    const heading = document.createElement('h3');
    if (title && href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = title;
      heading.appendChild(a);
    } else if (title) {
      heading.textContent = title;
    }
    if (title) textCell.push(heading);
    if (subadvisor) {
      const p = document.createElement('p');
      p.textContent = subadvisor;
      textCell.push(p);
    }

    cells.push([imgCell, textCell]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards (offerings)', cells });
  element.replaceWith(block);
}

/**
 * "feature" variant: Divi welcome section `.et_pb_row_1.et_pb_equal_columns`
 * with two `.et_pb_column`s, each wrapping content in an anchor
 * (`.welcomelink1/2`, href `/cit/cit-services`, `/cit/matrix-cits`). Inside
 * `.et_pb_text_inner`: first `<h4><strong>` = title, second `<h4>` = body —
 * with a hidden duplicate in `.ephox-sloth-bin` that must be dropped so the
 * description is not doubled. The cards decorator makes the whole tile clickable
 * when the card body contains an a[href], so the title heading carries the link.
 */
function parseFeature(element, document) {
  const cells = [];

  let columns = [...element.querySelectorAll(':scope > .et_pb_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.et_pb_column')];

  columns.forEach((col) => {
    const anchor = col.querySelector('a[href]');
    const href = anchor ? anchor.getAttribute('href') : '';
    const scope = col.querySelector('.et_pb_text_inner') || anchor || col;

    // Drop hidden duplicate copies (Divi/ephox editor bins) so body isn't doubled.
    scope.querySelectorAll('.ephox-sloth-bin').forEach((n) => n.remove());

    const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    const titleText = headings.length
      ? headings[0].textContent.replace(/\s+/g, ' ').trim()
      : '';
    if (headings.length) headings[0].remove();

    const bodyText = scope.textContent.replace(/\s+/g, ' ').trim();
    if (!titleText && !bodyText) return;

    // Single cell per card (no-images convention).
    const cell = [];
    const heading = document.createElement('h3');
    if (titleText && href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = titleText;
      heading.appendChild(a);
    } else {
      heading.textContent = titleText;
    }
    if (titleText) cell.push(heading);

    if (bodyText) {
      const p = document.createElement('p');
      p.textContent = bodyText;
      cell.push(p);
    }

    cells.push([cell]);
  });

  if (cells.length <= 1) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards (feature)', cells });
  element.replaceWith(block);
}

export default function parse(element, { document }) {
  // "offerings" grid (Matrix CITs): tiles are anchors with class box-cover.
  const tiles = [...element.querySelectorAll('a.box-cover')];
  if (tiles.length) {
    parseOfferings(element, tiles, document);
    return;
  }

  // Default: text-only "feature" tiles (welcome section columns).
  parseFeature(element, document);
}
