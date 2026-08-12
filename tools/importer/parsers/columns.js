/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `columns` (merged: base "media" + "compare" variant).
 * Base block: columns. Source: https://www.broadridge.com/cit/
 *
 * Block table structure (EDS Columns convention):
 *   Row 1: block name (+ optional variant) -> "Columns" or "Columns (compare)"
 *   Row 2: one cell per column (the layout row)
 *
 * Variant detection from content:
 *   - COMPARE: 2+ text columns each with a comparison list AND genuine
 *     is/is-not semantics — the source Divi `.checks`/`.exes` list classes
 *     (cit-landing `.et_pb_row_4`) OR column headings ending in "are:"/"are not:"
 *     ("CITs are:" checks | "CITs are not:" exes) -> "Columns (compare)".
 *     Inline glyphs stripped; each column's multiple single-item <ul>s merged
 *     into one <ul>; the block's `compare` variant renders check/cross icons.
 *     A plain 2-column list WITHOUT those markers is NOT a compare (see below).
 *   - MULTI-COLUMN (base): 2+ text columns, no image, no compare markers ->
 *     "Columns". One row, one cell per source column (each cell keeps its own
 *     <ul>/prose). Used for the financial-advisers two-column solutions list
 *     (LEFT: ModelTool(k)it… | RIGHT: Sales Enablement…) — a genuine side-by-side
 *     layout with no check/cross semantics.
 *   - MEDIA (base): one row, TEXT | IMAGE -> "Columns".
 *     A) Characteristics (`.et_pb_row_2`): H2 lead-in + H3 intro + list | photo.
 *     B) Closing CTA (`.et_pb_row_5`): H2 + paragraph + "TALK TO US" button | photo.
 *
 * Normalization (media): source H1 -> H2 (hero owns page H1); Divi
 * <h3><p>…</p></h3> wrappers unwrapped; per-<li> <h3> flattened to list text;
 * CTA emitted as a lone link (EDS decorates a standalone link as a button).
 */

function cleanText(node) {
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

function buildList(srcList, document) {
  const tag = srcList.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul';
  const list = document.createElement(tag);
  [...srcList.querySelectorAll(':scope > li')].forEach((li) => {
    const text = cleanText(li);
    if (!text) return;
    const nli = document.createElement('li');
    nli.textContent = text;
    list.appendChild(nli);
  });
  return list.children.length ? list : null;
}

function pushCleaned(node, document, out) {
  const tag = (node.tagName || '').toLowerCase();
  if (!tag) return;

  if (tag === 'ul' || tag === 'ol') {
    const list = buildList(node, document);
    if (list) out.push(list);
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    if (node.querySelector('p, div, ul, ol')) {
      [...node.children].forEach((c) => pushCleaned(c, document, out));
      return;
    }
    const text = cleanText(node);
    if (!text) return;
    const level = tag === 'h1' ? 'h2' : tag; // demote page-level H1 to H2
    const h = document.createElement(level);
    h.textContent = text;
    out.push(h);
    return;
  }

  if (tag === 'p') {
    const text = cleanText(node);
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

  const btn = col.querySelector('a.et_pb_button, a.open-talk-to-us, .et_pb_button_module_wrapper a[href]');
  if (btn) {
    const label = cleanText(btn);
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

function buildCompareColumn(col, document) {
  const cell = [];
  const scope = col.querySelector('.et_pb_text_inner') || col;

  const srcHeading = scope.querySelector('h1, h2, h3, h4, h5, h6');
  if (srcHeading) {
    const text = cleanText(srcHeading);
    if (text) {
      const h = document.createElement('h3');
      h.textContent = text;
      cell.push(h);
    }
  }

  const items = [];
  scope.querySelectorAll('ul li, ol li').forEach((li) => {
    const text = cleanText(li).replace(/^[✓✔✗✘•\-–\s]+/, '').trim();
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
}

// A column heading of the form "… are:" / "… are not:" signals genuine
// is/is-not comparison semantics (e.g. "CITs are:" / "CITs are not:").
function hasCompareHeading(col) {
  const heading = col.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) return false;
  const text = cleanText(heading).toLowerCase();
  return /\bare\s*:$/.test(text) || /\bare\s+not\s*:$/.test(text);
}

// COMPARE requires (a) 2+ text columns that each contain a list AND (b) real
// is/is-not semantics — either the source Divi `.checks`/`.exes` list classes
// or column headings ending in "are:"/"are not:". A plain 2-column bulleted
// list (financial-advisers solutions) has neither, so it stays a base Columns
// block rather than rendering spurious check/cross icons.
function isCompare(columns) {
  const textCols = columns.filter((c) => !c.querySelector('img[src]'));
  if (textCols.length < 2) return false;
  if (!textCols.every((c) => c.querySelector('ul li, ol li'))) return false;
  const hasCompareClasses = columns.some((c) => c.querySelector('ul.checks, ul.exes'));
  const hasCompareHeadings = textCols.some((c) => hasCompareHeading(c));
  return hasCompareClasses || hasCompareHeadings;
}

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > .et_pb_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.et_pb_column')];

  if (isCompare(columns)) {
    const cellsRow = columns.map((col) => buildCompareColumn(col, document)).filter((c) => c.length);
    if (!cellsRow.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, {
      name: 'Columns (compare)',
      cells: [cellsRow],
    });
    element.replaceWith(block);
    return;
  }

  // MULTI-COLUMN (base): 2+ source columns, none containing an image, and
  // compare already ruled out. Emit one cell per source column so the genuine
  // side-by-side layout is preserved (financial-advisers two-column solutions
  // list: LEFT list | RIGHT list). li>h3 items are flattened to plain list text
  // by collectTextColumn/buildList.
  const imageCols = columns.filter((c) => c.querySelector('img[src]'));
  const textOnlyCols = columns.filter((c) => !c.querySelector('img[src]'));
  if (columns.length >= 2 && imageCols.length === 0 && textOnlyCols.length >= 2) {
    const row = textOnlyCols.map((col) => {
      const cell = collectTextColumn(col, document);
      return cell.length ? cell : '';
    });
    if (row.some((c) => c && c.length)) {
      const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', cells: [row] });
      element.replaceWith(block);
      return;
    }
  }

  // MEDIA: text | image
  const textCell = [];
  let imageEl = null;
  if (columns.length) {
    columns.forEach((col) => {
      const img = col.querySelector('img[src]');
      if (img && !imageEl) {
        imageEl = img;
      } else if (!img) {
        textCell.push(...collectTextColumn(col, document));
      }
    });
  } else {
    // No Divi columns (e.g. `section.CTA-line`): treat the whole element as a
    // single text column — heading + paragraph + CTA button, no image.
    textCell.push(...collectTextColumn(element, document));
  }

  if (!textCell.length && !imageEl) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Text | image when an image exists; otherwise a single text-only column
  // (one cell) so the closing CTA renders without an empty image column.
  const cells = imageEl
    ? [[textCell.length ? textCell : '', imageEl]]
    : [[textCell.length ? textCell : '']];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', cells });
  element.replaceWith(block);
}
