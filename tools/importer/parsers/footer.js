/* eslint-disable */
/* global WebImporter */
/**
 * Builder for the shared footer chrome document (`/footer`).
 *
 * This is NOT a block parser — it is a "chrome extractor" that constructs the
 * target footer document structure directly. The repo's blocks/footer/footer.js
 * simply appends the footer fragment; blocks/footer/footer.css styles:
 *   - headings (h3) as link-group titles,
 *   - `footer .footer > div > div:has(ul)` as a flex row at >=600px (the link
 *     groups), and
 *   - link/social/legal styling.
 *
 * Because the fragment content round-trips through markdown (html2md -> md2da),
 * only default content survives (headings, lists, paragraphs, links) — raw
 * grouping <div>s do not. So the two link groups are emitted as flat default
 * content (h3 + ul + h3 + ul); after section decoration they share ONE
 * .default-content-wrapper, which `:has(ul)` turns into the flex row footer.css
 * expects. Social + copyright + legal live in a second section (paragraphs, no
 * <ul>) so they are NOT pulled into that flex row.
 *
 * Content is DEFAULT CONTENT only — no block tables, no metadata block, no
 * section-metadata.
 *
 * Source of truth (authoritative server HTML, `curl https://www.broadridge.com/cit/`):
 *   footer .footer__nav-links (two groups), footer social links, legal bar.
 */

const LINK_GROUPS = [
  {
    title: 'Matrix Trust',
    links: [
      { label: 'Home', href: '/cit/' },
      { label: 'CIT Service', href: '/cit/cit-services' },
      { label: 'Matrix CITs', href: '/cit/matrix-cits' },
      { label: 'About Us', href: '/cit/about-us' },
      { label: 'Matrix Terms of Service', href: '/cit/terms-and-conditions' },
    ],
  },
  {
    title: 'Matrix Solutions',
    links: [
      { label: 'Broker-Dealers', href: '/cit/broker-dealer-platform' },
      { label: 'Banks & Trusts', href: '/cit/banks-and-trusts' },
      { label: 'TPAs & Recordkeepers', href: '/cit/tpas-and-record-keepers' },
      { label: 'Financial Advisers', href: '/cit/financial-advisers' },
    ],
  },
];

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/BroadridgeCareers' },
  { label: 'Twitter', href: 'https://twitter.com/broadridge' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/broadridge-financial-solutions' },
  { label: 'YouTube', href: 'https://www.youtube.com/c/broadridge' },
];

const COPYRIGHT = '© 2026 Broadridge Financial Solutions, Inc. All Rights Reserved.';

// Source uses javascript:void(0) for these — emit placeholder "#" hrefs.
const LEGAL = [
  'Terms of Use & Linking Policy',
  'Accessibility Statement',
  'Legal Statements',
  'Privacy Statement',
  'Do Not Sell My Personal Information',
  'Your Privacy Choices',
];

function makeLink(doc, { href, label }) {
  const a = doc.createElement('a');
  a.href = href;
  a.textContent = label;
  return a;
}

/**
 * Build the footer chrome document.
 * @param {Document} doc owner document (from the import payload)
 * @returns {HTMLElement} detached <main> element to serialize
 */
export default function buildFooter(doc) {
  const main = doc.createElement('main');

  // --- Section 1: link groups (heading + list, heading + list) ---
  LINK_GROUPS.forEach((group) => {
    const h = doc.createElement('h3');
    h.textContent = group.title;
    main.append(h);

    const ul = doc.createElement('ul');
    group.links.forEach((link) => {
      const li = doc.createElement('li');
      li.append(makeLink(doc, link));
      ul.append(li);
    });
    main.append(ul);
  });

  main.append(doc.createElement('hr'));

  // --- Section 2: social + copyright + legal (paragraphs, no <ul>) ---
  const socialP = doc.createElement('p');
  SOCIAL.forEach((s, i) => {
    if (i > 0) socialP.append(doc.createTextNode(' '));
    socialP.append(makeLink(doc, s));
  });
  main.append(socialP);

  const copyP = doc.createElement('p');
  copyP.textContent = COPYRIGHT;
  main.append(copyP);

  const legalP = doc.createElement('p');
  LEGAL.forEach((label, i) => {
    if (i > 0) legalP.append(doc.createTextNode(' / '));
    legalP.append(makeLink(doc, { href: '#', label }));
  });
  main.append(legalP);

  return main;
}
