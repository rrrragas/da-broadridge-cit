/* eslint-disable */
/* global WebImporter */
/**
 * Builder for the shared navigation chrome document (`/nav`).
 *
 * This is NOT a block parser — it is a "chrome extractor" that constructs the
 * target nav document structure directly. The source page's client JS is broken
 * (the live nav never hydrates), so rather than scrape unreliable DOM we build the
 * canonical structure the repo's blocks/header/header.js contract expects.
 *
 * header.js maps the nav document's THREE top-level sections to:
 *   [0] -> .nav-brand   (logo link)
 *   [1] -> .nav-sections (the <ul> of top-level links; a <li> with a nested <ul>
 *                         auto-becomes a .nav-drop dropdown)
 *   [2] -> .nav-tools   (utility link)
 *
 * We emit brand / sections / tools separated by <hr> so html2md -> md2da renders
 * them as three separate top-level <div> sections in nav.plain.html.
 *
 * Content is DEFAULT CONTENT (image link, list, link) — no block tables, no
 * metadata block, no section-metadata.
 *
 * Source of truth (authoritative server HTML, `curl https://www.broadridge.com/cit/`):
 *   #main-header .logo_container a[href="/cit/"] > img (alt "CIF logo")
 *   #top-menu-nav ul#top-menu top-level items.
 */

const BRAND = {
  href: '/cit/',
  img: 'https://www.broadridge.com/cit/_assets/images/2023/br.com-sprint-17-matrix.png',
  alt: 'Matrix Trust Company',
};

// Top-level nav items (order matters). `href: null` => label-only parent that
// carries a nested `children` list (becomes a .nav-drop dropdown in header.js).
const SECTIONS = [
  { label: 'HOME', href: '/cit/' },
  { label: 'CIT SERVICES', href: '/cit/cit-services' },
  { label: 'MATRIX CITs', href: '/cit/matrix-cits' },
  {
    label: 'MATRIX SOLUTIONS',
    href: null,
    children: [
      { label: 'Broker-Dealers', href: '/cit/broker-dealer-platform' },
      { label: 'Banks & Trusts', href: '/cit/banks-and-trusts' },
      { label: 'TPAs & Recordkeepers', href: '/cit/tpas-and-record-keepers' },
      { label: 'Financial Advisers', href: '/cit/financial-advisers' },
    ],
  },
  { label: 'ABOUT US', href: '/cit/about-us' },
  { label: 'TALK TO US', href: '#talk-to-us' },
];

const TOOLS = { label: 'TALK TO US', href: '#talk-to-us' };

function makeLink(doc, { href, label }) {
  const a = doc.createElement('a');
  a.href = href;
  a.textContent = label;
  return a;
}

/**
 * Build the nav chrome document.
 * @param {Document} doc owner document (from the import payload)
 * @returns {HTMLElement} detached <main> element to serialize
 */
export default function buildNav(doc) {
  const main = doc.createElement('main');

  // --- Section [0]: BRAND (logo link) ---
  const brandP = doc.createElement('p');
  const brandA = doc.createElement('a');
  brandA.href = BRAND.href;
  const img = doc.createElement('img');
  img.src = BRAND.img;
  img.alt = BRAND.alt;
  brandA.append(img);
  brandP.append(brandA);
  main.append(brandP);

  main.append(doc.createElement('hr'));

  // --- Section [1]: SECTIONS (single <ul> of top-level links) ---
  const ul = doc.createElement('ul');
  SECTIONS.forEach((item) => {
    const li = doc.createElement('li');
    if (item.href) {
      li.append(makeLink(doc, item));
    } else {
      // Label-only parent (no href) — plain text label before the nested <ul>.
      li.append(doc.createTextNode(item.label));
    }
    if (Array.isArray(item.children) && item.children.length) {
      const sub = doc.createElement('ul');
      item.children.forEach((child) => {
        const subLi = doc.createElement('li');
        subLi.append(makeLink(doc, child));
        sub.append(subLi);
      });
      li.append(sub);
    }
    ul.append(li);
  });
  main.append(ul);

  main.append(doc.createElement('hr'));

  // --- Section [2]: TOOLS (utility link) ---
  const toolsP = doc.createElement('p');
  toolsP.append(makeLink(doc, TOOLS));
  main.append(toolsP);

  return main;
}
