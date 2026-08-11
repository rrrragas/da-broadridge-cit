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
 *   - COMPARE: 2+ text columns each a heading + comparison list
 *     (`.et_pb_row_4`: "CITs are:" checks | "CITs are not:" exes) -> "Columns (compare)".
 *     Inline glyphs stripped; each column's multiple single-item <ul>s merged
 *     into one <ul>; the block's `compare` variant renders check/cross icons.
 *   - MEDIA (default): one row, TEXT | IMAGE -> "Columns".
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

function isCompare(columns) {
  const textCols = columns.filter((c) => !c.querySelector('img[src]'));
  if (textCols.length < 2) return false;
  return textCols.every((c) => c.querySelector('ul li, ol li'));
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

  // MEDIA: text | image
  const textCell = [];
  let imageEl = null;
  columns.forEach((col) => {
    const img = col.querySelector('img[src]');
    if (img && !imageEl) {
      imageEl = img;
    } else if (!img) {
      textCell.push(...collectTextColumn(col, document));
    }
  });

  if (!textCell.length && !imageEl) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [[textCell.length ? textCell : '', imageEl || '']];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', cells });
  element.replaceWith(block);
}
