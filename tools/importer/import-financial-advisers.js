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

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (financial-advisers)
//
// David's Model: prose stays default content; blocks only where structure demands.
//   s1 Hero            -> hero-banner (H1 "Financial Advisers" + subhead
//                         "Stand out from your competitors").
//   s2 Intro/Value     -> DEFAULT CONTENT: the intro band `div[style*="27px"]` holds
//                         the TrueOpen Platform prose (a Divi <h3> demoted to <p> by
//                         cleanup), a divider, then a 2-column Divi row whose LEFT cell
//                         is the "Attract new prospects…" heading and RIGHT cell is the
//                         process-flow diagram image. Authored as heading + image + prose
//                         default content (NOT a block) — the diagram keeps its real src
//                         so WebImporter.adjustImageUrls resolves it.
//   s3 Solutions       -> section `et_pb_section_2`. The "Satisfy the growing demand of
//                         customers." heading (a second page <h1>, demoted to <h2> by
//                         cleanup) and the "Our solution provides…" value prop stay as
//                         section default content ABOVE the block. The genuine
//                         two-column solutions list (`et_pb_row_4`: LEFT list |
//                         RIGHT list) becomes a BASE columns block — one row, one cell
//                         per source column, each a <ul>. It has NO is/is-not semantics
//                         (no `.checks`/`.exes` classes, no "are:"/"are not:" headings)
//                         so columns.isCompare() returns false and it emits "Columns",
//                         NOT "Columns (compare)".
//   s4 Closing CTA     -> columns (text-only): "Find out more…" H2 + TALK TO US button.
//                         columns.js rewrites the CTA href (# / javascript:void(0)) ->
//                         #talk-to-us. Parse the inner `div.CTA-cover` so the outer
//                         `section.CTA-line` survives as the s4 section wrapper.
//   s5 Talk to Us form -> form-contact. #talk-to-us is a body-level modal; the sections
//                         transformer relocates it to the END before parsing.
const PAGE_TEMPLATE = {
  name: 'financial-advisers',
  description: 'CIT Financial Advisers page: hero-banner (H1 "Financial Advisers" + subhead "Stand out from your competitors"), intro/value-prop default content (TrueOpen Platform prose + "Attract new prospects" heading + process-flow diagram image, in the div[style*=27px] intro band), section-2 default content ("Satisfy the growing demand of customers." heading demoted from a second page <h1>, plus the "Our solution provides…" value prop) above a genuine two-column solutions list rendered as a BASE columns block (LEFT: ModelTool(k)it, Unitized Managed Accounts, Collective Investment Trusts, Sales Enablement, Level Compensation & RIA Payment Services | RIGHT: Data Feeds, Mutual Fund Trading Platform, ETF Trading Platform, Trust and Custody). The solutions list has no is/is-not semantics (no .checks/.exes classes, no "are:"/"are not:" headings) so it emits Columns, NOT Columns (compare). Closing CTA columns (text-only, TALK TO US rewritten to #talk-to-us), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/broker-dealer parsers and transformers; adds no new blocks.',
  urls: [
    'https://www.broadridge.com/cit/financial-advisers',
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
      // Two columns instances:
      //   1) the genuine two-column solutions list (`et_pb_section_2 > et_pb_row_4`)
      //      -> base "Columns" (2 cells). Leaving the outer `et_pb_section_2`
      //      untouched preserves it as the s3 wrapper (its row_2 heading +
      //      value-prop stay as default content above the block).
      //   2) the closing CTA inner `div.CTA-cover` -> single text-only column.
      name: 'columns',
      instances: [
        '#main-content > div.et_pb_section_2 > div.et_pb_row_4',
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
      hint: 'block',
    },
    {
      id: 's2',
      name: 'Intro and Value Prop',
      selector: ['#main-content > div[style*="27px"]'],
      style: null,
      blocks: [],
      defaultContent: ['#main-content > div[style*="27px"]'],
      hint: 'default-content',
    },
    {
      id: 's3',
      name: 'Solutions',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: ['columns'],
      defaultContent: ['#main-content > div.et_pb_section_2 > div.et_pb_row_2 .et_pb_text_inner'],
      hint: 'block',
    },
    {
      id: 's4',
      name: 'Closing CTA',
      selector: ['#main-content > section.CTA-line'],
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
    //    the final path segment (e.g. /cit/financial-advisers ->
    //    financial-advisers), so the content file is content/<slug>.plain.html.
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
