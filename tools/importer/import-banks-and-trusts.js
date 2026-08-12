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

// PARSER REGISTRY — reuses the shared CIT parsers (no new blocks). cardsParser is
// registered for parity with the sibling CIT pages even though this page has no
// cards block (its 5-item feature list is authored as a plain bulleted list).
const parsers = {
  'hero-banner': heroBannerParser,
  cards: cardsParser,
  'form-contact': formContactParser,
  columns: columnsParser,
};

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (banks-and-trusts)
//
// David's Model: prose + bulleted lists stay default content; blocks only where
// structure demands. Same top-level layout as broker-dealer-platform (hero ->
// `div[style*="27px"]` intro -> `et_pb_section_2` features -> `section.CTA-line`,
// all under #main-content), but this page has NO cards:
//   s1 Hero            -> hero-banner (H1 "Banks & Trusts" + subhead "Trade with
//                         efficiency and carefully monitor how you utilize your
//                         resources").
//   s2 Intro/Value     -> DEFAULT CONTENT: the intro value-prop paragraph (authored
//                         as a Divi <h3>, demoted to <p> by cleanup since >180 chars),
//                         the "Reduce the risk and expense…" <h2>, and the process/
//                         data-flow diagram image (diagram.jpg). Divi wraps all of
//                         this in one classless `div[style*="27px"]` wrapper.
//   s3 Trading Solutions -> DEFAULT CONTENT: secondary heading "Step up to customer
//                         demands with more efficient daily trading." (authored as a
//                         second page <h1>, demoted to <h2> by cleanup), the
//                         "A comprehensive suite…" lead-in, and the 5-item feature
//                         list (ModelTool(k)it, Mutual Fund Trading Platform, ETF
//                         Trading Platform, Money Market Portal, IRA solutions). The
//                         source authors the list as `<ul><li><h3>item</h3></li>…`;
//                         it is a plain bulleted list (no images / descriptions /
//                         per-item links), NOT repeating tiles, so it stays a
//                         default-content <ul> (cleanup unwraps the per-<li> <h3> to
//                         plain list text). NOT a cards block.
//   s4 Closing CTA     -> columns (text-only): "Find out more about Matrix Trust
//                         Company collective investment trusts" <h2> + TALK TO US
//                         button. section.CTA-line has no Divi columns, so the
//                         columns parser emits a single text-only column and rewrites
//                         the button href ("#") to #talk-to-us.
//   Talk to Us form    -> form-contact. #talk-to-us is a body-level modal; the
//                         sections transformer relocates it to the END before parsing
//                         so the form block lands last in document order.
const PAGE_TEMPLATE = {
  name: 'banks-and-trusts',
  description: 'CIT Banks & Trusts page: hero-banner, intro/value-prop default content (value-prop paragraph + "Reduce the risk" heading + diagram image), trading-solutions default content ("Step up to customer demands" heading demoted from a second page <h1>, "A comprehensive suite" lead-in, and a 5-item feature bulleted list: ModelTool(k)it, Mutual Fund Trading Platform, ETF Trading Platform, Money Market Portal, IRA solutions), columns (closing CTA, text-only, "#"/javascript:void(0) rewritten to #talk-to-us), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/cit-offerings parsers and transformers; adds no new blocks and has no cards on this page.',
  urls: [
    'https://www.broadridge.com/cit/banks-and-trusts',
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
      // Closing CTA: parse the inner `div.CTA-cover` so the outer
      // `section.CTA-line` survives as the s4 section wrapper. CTA-line has no
      // Divi columns, so the columns parser emits a single text-only column
      // (H2 + "TALK TO US" button, "#"/javascript:void(0) rewritten to
      // #talk-to-us).
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
      name: 'Trading Solutions',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: [],
      defaultContent: [
        '#main-content > div.et_pb_section_2 > div.et_pb_row_2 .et_pb_text_inner',
        '#main-content > div.et_pb_section_2 > div.et_pb_row_4 .et_pb_text_inner',
      ],
      hint: 'default-content',
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
    //    the final path segment (e.g. /cit/banks-and-trusts -> banks-and-trusts),
    //    so the content file is content/<slug>.plain.html. Falls back to /index
    //    when the URL has no path segment (empty path crashes the importer).
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
