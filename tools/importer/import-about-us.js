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

// PARSER REGISTRY — reuses the shared CIT parsers (no new blocks).
const parsers = {
  'hero-banner': heroBannerParser,
  cards: cardsParser,
  'form-contact': formContactParser,
  columns: columnsParser,
};

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (about-us)
const PAGE_TEMPLATE = {
  name: 'about-us',
  description: 'CIT About Us page (Matrix Trust Company): hero-banner, intro default content (Colorado charter / 50+ yrs / SSAE18 prose), value-prop default content (heading + two paragraphs), 12-item solutions bulleted list as default content (<ul>), columns (closing CTA, text-only), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing parsers and transformers; no cards on this page.',
  urls: [
    'https://www.broadridge.com/cit/about-us',
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
      // as the Closing CTA section wrapper. The CTA-line has no Divi columns, so
      // the columns parser emits a single text-only column (H2 + "TALK TO US"
      // button, javascript:void(0)/# rewritten to #talk-to-us).
      name: 'columns',
      instances: [
        '#page-container > section.CTA-line > div.CTA-cover',
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
      hint: 'block',
    },
    {
      id: 's2',
      name: 'Intro',
      selector: ['#main-content > div.et_pb_section_1.welcomeSection'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['.welcomeSection .et_pb_row_0 .et_pb_text_inner'],
      hint: 'default-content',
    },
    {
      id: 's3',
      name: 'Value Proposition and Solutions',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: [],
      defaultContent: [
        '.et_pb_section_2 .et_pb_row .et_pb_text_inner',
        '.et_pb_section_2 .et_pb_row_2 .et_pb_text_inner',
      ],
      hint: 'default-content',
    },
    {
      id: 's4',
      name: 'Closing CTA',
      selector: ['#page-container > section.CTA-line'],
      style: null,
      blocks: ['columns'],
      defaultContent: [],
      hint: 'block',
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
    //    the final path segment (e.g. /cit/about-us -> about-us), so the content
    //    file is content/<slug>.plain.html. Falls back to /index when the URL has
    //    no path segment (empty path crashes the importer).
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
