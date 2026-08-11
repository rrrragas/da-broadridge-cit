/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `cards-feature`.
 * Base block: cards ("no images" variant — text-only tiles).
 * Source: https://www.broadridge.com/cit/
 * Generated: 2026-08-11
 *
 * Library structure ("Cards (no images)"): 1 column, multiple rows.
 *   Row 1     -> block name
 *   Each row  -> one card. Single cell containing:
 *                Title (heading) + Description (paragraph) + optional CTA link.
 *
 * cards-feature decorator: each row becomes an <li>; if the card body contains
 * an `a[href]` the whole tile is made clickable (stretched link). So each card
 * cell must carry a link to make the tile clickable. We attach the href to the
 * title heading (the source wraps the entire tile in an <a>).
 *
 * Source DOM (Divi welcome section): the row `.et_pb_row_1.et_pb_equal_columns`
 * has two `.et_pb_column` children. Each column wraps its content in an anchor
 * (`.welcomelink1` / `.welcomelink2`, href `/cit/cit-services`, `/cit/matrix-cits`).
 * Inside `.et_pb_text_inner`: first `<h4><strong>` = title, second `<h4>` = body
 * text — which also contains a hidden duplicate inside `.ephox-sloth-bin` that
 * must be dropped so the description is not doubled.
 */
export default function parse(element, { document }) {
  const cells = [];

  // Each column is one card. Direct children first, fall back to any descendant.
  let columns = [...element.querySelectorAll(':scope > .et_pb_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.et_pb_column')];

  columns.forEach((col) => {
    const anchor = col.querySelector('a[href]');
    const href = anchor ? anchor.getAttribute('href') : '';

    // Work inside the text wrapper when present so we ignore column chrome.
    const scope = col.querySelector('.et_pb_text_inner') || anchor || col;

    // Drop hidden duplicate copies (Divi/ephox editor bins) so body isn't doubled.
    scope.querySelectorAll('.ephox-sloth-bin').forEach((n) => n.remove());

    // Title = first heading. Remove it so the remaining text is the description.
    const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    const titleText = headings.length
      ? headings[0].textContent.replace(/\s+/g, ' ').trim()
      : '';
    if (headings.length) headings[0].remove();

    const bodyText = scope.textContent.replace(/\s+/g, ' ').trim();

    if (!titleText && !bodyText) return; // skip empty column

    const cell = [];

    // Title as a heading; when we have an href, wrap it in a link so the whole
    // tile becomes clickable via the decorator's stretched-link behavior.
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

    // 1-column block: one row, one cell holding all card elements.
    cells.push([cell]);
  });

  // Empty-block guard.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-feature', cells });
  element.replaceWith(block);
}
