/* eslint-disable */
/* global WebImporter */

// CHROME BUILDER IMPORT
import buildNav from './parsers/nav.js';

/**
 * Import script for the shared navigation chrome document.
 *
 * Unlike the page import scripts (import-cit-landing.js et al.) this does NOT
 * scrape the source DOM — the live nav's client JS is broken. It builds the
 * canonical nav document structure directly from the authoritative spec
 * (see parsers/nav.js) and returns it at the fixed path `/nav` so the bulk
 * runner writes content/nav.plain.html.
 *
 * The returned element is DEFAULT CONTENT (image link + list + link) split by
 * <hr> into the three top-level sections blocks/header/header.js maps to
 * brand / sections / tools. No block tables, no metadata block.
 */
export default {
  transform: (payload) => {
    const { document } = payload;

    const main = buildNav(document);

    return [{
      element: main,
      path: '/nav',
      report: {
        title: 'Navigation',
        type: 'chrome',
      },
    }];
  },
};
