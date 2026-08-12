/* eslint-disable */
/* global WebImporter */

// CHROME BUILDER IMPORT
import buildFooter from './parsers/footer.js';

/**
 * Import script for the shared footer chrome document.
 *
 * Builds the canonical footer document structure directly from the
 * authoritative spec (see parsers/footer.js) and returns it at the fixed path
 * `/footer` so the bulk runner writes content/footer.plain.html.
 *
 * The returned element is DEFAULT CONTENT (two heading+list link groups, then a
 * social paragraph, copyright paragraph, and legal paragraph) split by <hr>
 * into two top-level sections. No block tables, no metadata block.
 */
export default {
  transform: (payload) => {
    const { document } = payload;

    const main = buildFooter(document);

    return [{
      element: main,
      path: '/footer',
      report: {
        title: 'Footer',
        type: 'chrome',
      },
    }];
  },
};
