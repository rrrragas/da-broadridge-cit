/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `columns-compare`.
 * Base block: columns (side-by-side comparison lists variant).
 * Source: https://www.broadridge.com/cit/
 * Generated: 2026-08-11
 *
 * Library structure: multiple columns/rows; column count = visual grouping.
 * Here: a single row with 2 columns — positive list | negative list.
 *   Col 1 (positive): H3 "CITs are:"     + list of affirmative bullets.
 *   Col 2 (negative): H3 "CITs are not:" + list of negative bullets.
 * The columns-compare decorator tags col 1 `.columns-compare-positive` and the
 * last col `.columns-compare-negative`, rendering check/cross glyphs via CSS
 * `::before`. So bullets must NOT carry inline glyphs.
 *
 * Source DOM (`.et_pb_row_4`): two `.et_pb_column`s. Each has an H3 title
 * (wrapping <strong>) followed by MULTIPLE single-item `<ul class="checks">` /
 * `<ul class="exes">` lists — one <ul> per bullet. We merge those into ONE
 * <ul> per column and strip the source's check/cross styling (the `checks`/
 * `exes` classes drive glyphs via the legacy CSS; the EDS block handles glyphs).
 */
export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > .et_pb_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.et_pb_column')];

  const buildColumn = (col) => {
    const cell = [];
    const scope = col.querySelector('.et_pb_text_inner') || col;

    // Heading (strip <strong> wrapper to plain heading text).
    const srcHeading = scope.querySelector('h1, h2, h3, h4, h5, h6');
    if (srcHeading) {
      const text = srcHeading.textContent.replace(/\s+/g, ' ').trim();
      if (text) {
        const h = document.createElement('h3');
        h.textContent = text;
        cell.push(h);
      }
    }

    // Merge every source <ul>/<ol> (each holding one <li>) into a single list,
    // stripping any inline check/cross glyphs so CSS renders the icon bullets.
    const items = [];
    scope.querySelectorAll('ul li, ol li').forEach((li) => {
      let text = li.textContent.replace(/\s+/g, ' ').trim();
      // Drop leading glyphs the source may inline (✓ ✔ ✗ ✘ • - –).
      text = text.replace(/^[✓✔✗✘•\-–\s]+/, '').trim();
      if (text) items.push(text);
    });
    if (items.length) {
      const ul = document.createElement('ul');
      items.forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
      });
      cell.push(ul);
    }

    return cell;
  };

  const cellsRow = columns.map((col) => buildColumn(col)).filter((c) => c.length);

  // Empty-block guard.
  if (!cellsRow.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // One row; one cell per source column (positive | negative).
  const cells = [cellsRow];

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-compare', cells });
  element.replaceWith(block);
}
