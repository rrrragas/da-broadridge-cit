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

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (broker-dealer-platform)
//
// David's Model: prose stays default content; blocks only where structure demands.
//   s1 Hero            -> hero-banner (H1 "Broker-Dealer Platform" + subhead).
//   s2 Intro/Value     -> DEFAULT CONTENT: intro paragraph, "Ensure compliance…" H2,
//                         and the process-flow diagram image (heading + image only —
//                         no block). Divi wraps all three in one classless <div>
//                         (`#main-content > div[style*="27px"]`). The intro copy and
//                         "Ensure…" line are authored as <h3>/<h2> in source and kept
//                         as default content; the diagram keeps its real src so
//                         WebImporter.adjustImageUrls resolves it.
//   s3 Features        -> cards (feature variant): 3 equal repeating one-third
//                         (`et_pb_column_1_3`) tiles in `et_pb_section_2 > et_pb_row_3`
//                         — "Plan Level Data Feed", "Fiduciary Tool(k)it", "Sales
//                         Enablement Resources", each title + description. The "Drive
//                         growth…" H2 (row_2) stays as section default content ABOVE
//                         the cards block. cards.parseFeature tolerates link-less tiles.
//   s4 Closing CTA     -> columns (text-only): "Find out more…" H2 + TALK TO US button.
//                         columns.js rewrites javascript:void(0)/# -> #talk-to-us.
//   s5 Talk to Us form -> form-contact. #talk-to-us is a body-level modal; the sections
//                         transformer relocates it to the END before parsing.
const PAGE_TEMPLATE = {
  name: 'broker-dealer-platform',
  description: 'CIT Broker-Dealer Platform page: hero-banner, intro/value-prop default content (paragraph + "Ensure compliance" heading + process-flow diagram image), cards (feature variant — 3 equal tiles: Plan Level Data Feed, Fiduciary Tool(k)it, Sales Enablement Resources) preceded by the "Drive growth" heading as section default content, columns (closing CTA, text-only), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/cit-offerings parsers and transformers.',
  urls: [
    'https://www.broadridge.com/cit/broker-dealer-platform',
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
      // Feature tiles: parse the row of three one-third columns. Leaving the
      // outer section (`et_pb_section_2`) untouched preserves it as the s3
      // wrapper (its `et_pb_row_2` "Drive growth" heading stays as default
      // content above the cards block).
      name: 'cards',
      instances: [
        '#main-content > div.et_pb_section_2 > div.et_pb_row_3',
      ],
    },
    {
      // Closing CTA: parse the inner `div.CTA-cover` so the outer
      // `section.CTA-line` survives as the s4 section wrapper.
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
      name: 'Intro and Value Prop',
      selector: ['#main-content > div[style*="27px"]'],
      style: null,
      blocks: [],
      defaultContent: ['#main-content > div[style*="27px"]'],
    },
    {
      id: 's3',
      name: 'Features',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: ['cards'],
      defaultContent: ['#main-content > div.et_pb_section_2 > div.et_pb_row_2 .et_pb_text_inner'],
    },
    {
      id: 's4',
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
    //    the final path segment (e.g. /cit/broker-dealer-platform ->
    //    broker-dealer-platform), so the content file is content/<slug>.plain.html.
    //    Falls back to /index when the URL has no path segment.
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
