/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `cards` ("feature" variant — text-only clickable tiles).
 * Base block: cards. Source: https://www.broadridge.com/cit/
 *
 * Follows the EDS "Cards (no images)" convention (text-only tiles):
 *   Row 1: block name (+ variant) -> "Cards (feature)"
 *   Each subsequent row: ONE cell = a single card, containing
 *     Heading (title, wrapped in the card link) + Description (paragraph).
 *
 * The cards decorator makes the whole tile clickable when the card body contains
 * an a[href], so the title heading carries the card link (the source wraps the
 * entire tile in an <a>).
 *
 * Source DOM (Divi welcome section `.et_pb_row_1.et_pb_equal_columns`): two
 * `.et_pb_column`s, each wrapping content in an anchor (`.welcomelink1/2`,
 * href `/cit/cit-services`, `/cit/matrix-cits`). Inside `.et_pb_text_inner`:
 * first `<h4><strong>` = title, second `<h4>` = body — with a hidden duplicate
 * in `.ephox-sloth-bin` that must be dropped so the description is not doubled.
 */
export default function parse(element, { document }) {
  // `createBlock` adds the block-name/variant header row itself; do NOT seed one
  // here or "Cards (feature)" leaks in as an extra card row.
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
