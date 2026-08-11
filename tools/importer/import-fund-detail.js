/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS — reuses the shared CIT parsers (no new blocks).
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

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (fund-detail)
//
// David's Model: a CIT fund-detail page is almost entirely authorable prose +
// links, so only three sequences become blocks (hero-banner, the closing-CTA
// columns, and the Talk-to-Us form). Everything else is DEFAULT CONTENT:
//   - the risk-disclaimer NOTE (relocated out of the hero by the cleanup
//     transformer into a `div.fund-note`),
//   - the fund description paragraph(s) (and per-sub-fund strategy blurbs) in
//     `section.divided-welcome .left-side` (Divi <h3><p>…</p></h3> wrappers
//     unwrapped to clean paragraphs),
//   - the downloadable document links in `.right-side ul` (flattened to a clean
//     <ul> of links, every href preserved verbatim, empty spacer <li>s dropped),
//   - grouped/nested per-fund-series documents in `section.blue-prints` (GoalPath:
//     each group becomes an <h2> sub-heading + nested <ul>), and
//   - the optional subadvisor band (`div.et_pb_section_1.welcomeSection`).
// All of the fund-specific normalization lives in the SHARED broadridge-cleanup
// transformer, guarded on `section.divided-welcome` so it is a strict no-op on
// every other CIT page. No `cards` parser is needed (fund pages have no card grid).
const PAGE_TEMPLATE = {
  name: 'fund-detail',
  description: 'CIT fund-detail page (reusable across the ~23 Matrix Trust Company fund pages): hero-banner (H1 = fund family name + optional subhead), risk-disclaimer NOTE default content (relocated out of the hero into div.fund-note), fund overview + flat document-link list default content (section.divided-welcome: <h3>-wrapped description paragraphs unwrapped to <p>; .right-side <ul> flattened to clean links, empty spacer <li>s dropped, hrefs preserved verbatim), optional grouped/nested per-fund-series document lists default content (section.blue-prints: <h2> group heading + nested <ul>, GoalPath), optional subadvisor band default content (div.et_pb_section_1.welcomeSection: <h1> demoted to <h2>, blurb unwrapped, onclick popup link promoted to a real href), columns (closing CTA, text-only, #/javascript:void(0) rewritten to #talk-to-us), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/cit-services parsers and transformers; adds no new blocks and has no cards.',
  urls: [
    'https://www.broadridge.com/cit/mutual-of-america-stable-value-cit',
    'https://www.broadridge.com/cit/equity-armor-cits',
    'https://www.broadridge.com/cit/goalpath-portfolios',
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
      // button, `#`/javascript:void(0) rewritten to #talk-to-us).
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
      selector: ['#main-content > section.et_pb_fullwidth_header_0', 'section.et_pb_fullwidth_header_0'],
      style: null,
      blocks: ['hero-banner'],
      defaultContent: [],
      hint: 'block',
    },
    {
      id: 's2',
      name: 'Disclaimer',
      selector: ['#main-content > div.fund-note', 'div.fund-note'],
      style: null,
      blocks: [],
      defaultContent: ['div.fund-note'],
      hint: 'default-content',
    },
    {
      id: 's3',
      name: 'Fund Overview and Documents',
      selector: ['#main-content > section.divided-welcome', 'section.divided-welcome'],
      style: 'light-grey',
      blocks: [],
      defaultContent: [
        'section.divided-welcome .left-side',
        'section.divided-welcome .right-side ul',
      ],
      hint: 'default-content',
    },
    {
      id: 's4',
      name: 'Fund Series Documents',
      selector: ['#main-content > section.blue-prints', 'section.blue-prints'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['section.blue-prints'],
      hint: 'default-content',
    },
    {
      id: 's5',
      name: 'Subadvisor',
      selector: ['#main-content > div.et_pb_section_1.welcomeSection', 'div.et_pb_section_1.welcomeSection'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['div.et_pb_section_1.welcomeSection .et_pb_text_inner'],
      hint: 'default-content',
    },
    {
      id: 's6',
      name: 'Closing CTA',
      selector: ['#main-content > section.CTA-line', 'section.CTA-line'],
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

    // 1. beforeTransform (initial cleanup + fund-detail normalization + form relocation)
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

    // 6. sanitized path — CIT fund pages live at /cit/<slug>; the EDS output slug
    //    is the final path segment (e.g. /cit/goalpath-portfolios ->
    //    goalpath-portfolios), so the content file is content/<slug>.plain.html.
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
