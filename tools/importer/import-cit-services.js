/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroBannerParser from './parsers/hero-banner.js';
import formContactParser from './parsers/form-contact.js';
import columnsParser from './parsers/columns.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/broadridge-cleanup.js';
import sectionsTransformer from './transformers/broadridge-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-banner': heroBannerParser,
  'form-contact': formContactParser,
  columns: columnsParser,
};

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (cit-services)
//
// David's Model: this page is mostly authorable prose, so only three sequences
// become blocks (hero-banner, closing-CTA columns, and the Talk-to-Us form).
// The two value-prop intro sections, the six-item services list, and the
// downloadable brochure link are all DEFAULT CONTENT — they survive the
// transform untouched (aside from Divi-chrome cleanup + heading/prose
// normalization) and convert straight to markdown. No `cards` parser is needed
// here (the brochure is a plain link, not a card grid).
const PAGE_TEMPLATE = {
  name: 'cit-services',
  description: 'CIT Services page: hero-banner, two intro/value-prop default-content sections (prose paragraphs demoted from Divi <h3>), a 6-item services default-content <ul> (li>h3 flattened to list text) plus a CIT logo image, a downloadable brochure default-content link (box-cover PDF tile normalized to a clean link), columns (closing CTA, text-only, javascript:void(0) rewritten to #talk-to-us), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/cit-offerings parsers and transformers; adds no new blocks.',
  urls: [
    'https://www.broadridge.com/cit/cit-services',
  ],
  blocks: [
    {
      name: 'hero-banner',
      instances: [
        '#main-content > section.et_pb_fullwidth_header_0',
        'section.et_pb_fullwidth_header_0',
      ],
    },
    {
      // Parse the inner `div.CTA-cover` so the outer `section.CTA-line` survives
      // as the Closing CTA section wrapper.
      name: 'columns',
      instances: [
        '#main-content > section.CTA-line > div.CTA-cover',
        'section.CTA-line div.CTA-cover',
      ],
    },
    {
      name: 'form-contact',
      instances: [
        '#talk-to-us',
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
    },
    {
      id: 's2',
      name: 'Intro',
      selector: ['#main-content > div.et_pb_section_1.welcomeSection'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['.welcomeSection .et_pb_row_0 .et_pb_text_inner'],
    },
    {
      id: 's3',
      name: 'Value Prop and Services List',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: [],
      defaultContent: [
        '.et_pb_section_2 .et_pb_row_1 .et_pb_text_inner',
        '.et_pb_section_2 .et_pb_row_4',
      ],
    },
    {
      id: 's4',
      name: 'Brochure',
      selector: ['#main-content > div.box-container'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['div.box-container a.box-cover'],
    },
    {
      id: 's5',
      name: 'Closing CTA',
      selector: ['#main-content > section.CTA-line'],
      style: null,
      blocks: ['columns'],
      defaultContent: [],
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

    // 1. beforeTransform (initial cleanup)
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
    //    the final path segment (e.g. /cit/cit-services -> cit-services), so the
    //    content file is content/<slug>.plain.html. Falls back to /index when the
    //    URL has no path segment (empty path crashes the bundled importer).
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
