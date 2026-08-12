/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroBannerParser from './parsers/hero-banner.js';
import cardsParser from './parsers/cards.js';
import formContactParser from './parsers/form-contact.js';
import columnsParser from './parsers/columns.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/broadridge-cleanup.js';
import sectionsTransformer from './transformers/broadridge-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-banner': heroBannerParser,
  cards: cardsParser,
  'form-contact': formContactParser,
  columns: columnsParser,
};

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'cit-landing',
  description: 'CIT landing page: hero-banner, definition default content, cards (feature), form-contact, columns (media + compare). Shared header nav and footer chrome.',
  urls: [
    'https://www.broadridge.com/cit/',
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
      name: 'cards',
      instances: [
        '#main-content > div.et_pb_section_1.welcomeSection div.et_pb_row_1.et_pb_equal_columns',
        '.welcomeSection .et_pb_row_1.et_pb_equal_columns',
      ],
    },
    {
      name: 'form-contact',
      instances: [
        '#talk-to-us',
      ],
    },
    {
      name: 'columns',
      instances: [
        '#main-content > div.et_pb_section_2 > div.et_pb_row_2',
        '#main-content > div.et_pb_section_2 > div.et_pb_row_4',
        '#page-container > div.et_pb_section_3 > div.et_pb_row',
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
      name: 'Definition and Feature Cards',
      selector: ['#main-content > div.et_pb_section_1.welcomeSection'],
      style: 'light-grey',
      blocks: ['cards'],
      defaultContent: ['.welcomeSection .et_pb_row_0 .et_pb_text'],
    },
    {
      id: 's3',
      name: 'Characteristics',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: ['columns'],
      defaultContent: [],
    },
    {
      id: 's4',
      name: 'Closing CTA',
      selector: ['#page-container > div.et_pb_section_3'],
      style: 'light-grey',
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

    // 6. sanitized path — map root URL to /index (empty path crashes the bundled importer)
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

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
