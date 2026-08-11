/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroBannerParser from './parsers/hero-banner.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/broadridge-cleanup.js';
import sectionsTransformer from './transformers/broadridge-sections.js';

// PARSER REGISTRY — legal pages are almost entirely default content, so the only
// block is the hero-banner. No cards/columns/form-contact on this template.
const parsers = {
  'hero-banner': heroBannerParser,
};

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (legal)
//
// David's Model: the Matrix Terms of Service is a long legal document — almost
// entirely authorable prose (headings + paragraphs). It is NOT forced into
// blocks. Only the hero becomes a block (hero-banner); the entire Terms body is
// DEFAULT CONTENT and survives the transform untouched aside from Divi-chrome
// cleanup and the legal-page normalization in broadridge-cleanup.js (guarded on
// div.et_pb_text_inner-conditions): the ten section headings, authored as
// bold-only paragraphs (<p><strong>Title</strong></p>), are promoted to <h2>,
// and the shared #talk-to-us flyout chrome is removed (this page has no on-page
// Talk-to-Us trigger and no form-contact block to consume it).
//
// This page has NO closing CTA (no section.CTA-line) and NO Talk-to-Us form, so
// there are no columns/form-contact blocks — unlike the marketing CIT pages.
const PAGE_TEMPLATE = {
  name: 'legal',
  description: 'CIT legal page (Matrix Terms of Service): hero-banner (H1 "Matrix Terms of Service", background image, empty subhead), then the full Terms body as DEFAULT CONTENT — the opening acceptance statement, defined-terms paragraph, and ten legal sections (Hyperlinks to Third-Party Information and Value-Added Services; Matrix Company Does Not Provide Financial, Investment, Tax or Legal Advice on this Web Site; Arbitration and Governing Law Provisions [Denver, Colorado]; Acceptable Use; Security/Privacy; Disclosure of User Information; Downtime and Interruptions in Service; Termination; Modification; General Provisions) plus the closing CIT-risk paragraph with a /cit/matrix-cits link. The section headings are authored as bold-only paragraphs and promoted to <h2> by the legal-page normalization in broadridge-cleanup.js (guarded on div.et_pb_text_inner-conditions, a strict no-op on every other CIT page). No closing CTA and no Talk-to-Us form on this page — the shared #talk-to-us flyout chrome is removed. Shared header nav and footer chrome. Reuses the cit-landing hero-banner parser and the shared cleanup/sections transformers; adds no new blocks.',
  urls: [
    'https://www.broadridge.com/cit/terms-and-conditions',
  ],
  coverageGaps: [],
  blocks: [
    {
      name: 'hero-banner',
      instances: [
        '#main-content > section.et_pb_fullwidth_header_0',
        'section.et_pb_fullwidth_header_0',
      ],
    },
  ],
  sections: [
    {
      id: 's1',
      name: 'Hero',
      selector: ['#main-content > section.et_pb_fullwidth_header_0'],
      style: null,
      blocks: ['hero-banner'],
      defaultContent: [],
      hint: 'block',
    },
    {
      id: 's2',
      name: 'Terms of Service Body',
      selector: ['#main-content > div.et_pb_section_1'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['#main-content > div.et_pb_section_1 div.et_pb_text_inner-conditions'],
      hint: 'default-content',
    },
  ],
};

// TRANSFORMER REGISTRY — cleanup first, then sections (afterTransform adds <hr> + metadata)
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook.
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration.
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  const seen = new Set();
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const {
      document, url, html, params,
    } = payload;

    const main = document.body;

    // 1. beforeTransform (initial cleanup + legal-page normalization)
    executeTransformers('beforeTransform', main, payload);

    // 2. discover blocks
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. parse each block; skip elements already detached by an earlier parser
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. sanitized path — CIT pages live at /cit/<slug>; the EDS output slug is
    //    the final path segment (e.g. /cit/terms-and-conditions -> terms-and-conditions),
    //    so the content file is content/<slug>.plain.html. Falls back to /index
    //    when the URL has no path segment (empty path crashes the bundled importer).
    const pathname = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const slug = pathname.split('/').filter(Boolean).pop() || 'index';
    const path = WebImporter.FileUtils.sanitizePath(`/${slug}`);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
