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

// PAGE TEMPLATE CONFIGURATION — embedded from page-templates.json (tpas-and-record-keepers)
//
// David's Model: prose + plain bulleted lists stay default content; blocks only
// where structure demands. This page shares broker-dealer-platform's shell but
// has NO cards — its service list is a plain bulleted list, not equal tiles.
//   s1 Hero            -> hero-banner (H1 "TPAs & Recordkeepers" + subhead
//                         "Save time and resources while increasing accuracy").
//                         Source has no <img>; the section carries the hero bg via
//                         `style="background-image: url(...img_solution_herobg11...)"`,
//                         which hero-banner synthesizes into a background row.
//   s2 Intro/Value     -> DEFAULT CONTENT: the intro/value-prop paragraphs
//                         (regulatory changes/shrinking margins; the automated
//                         mutual-fund + ETF trading platform, TrueOpen approach,
//                         30,000+ funds — authored as Divi <h3>s and demoted to
//                         <p> by cleanup because they exceed ~180 chars), the
//                         "Eliminate the task…" callout heading, and the
//                         process-flow diagram image. All live in one classless
//                         `#main-content > div[style*="27px"]` wrapper. Hidden Divi
//                         spacer "-" headings are dropped by cleanup.
//   s3 Services        -> DEFAULT CONTENT: the "Satisfy the growing demand of
//                         customers." heading (a second page <h1> demoted to <h2>
//                         by cleanup — hero owns the only <h1>), the short prose
//                         line, and the 8-item service list. Divi authors the list
//                         as `<li><h3>item</h3></li>` split across two half-columns
//                         (ModelTool(k)it; Mutual Fund Trading Platform; ETF Trading
//                         Platform; Trust and Custody | SDBAs Assets Held Away and
//                         Managed Accounts; Unitization Services; Level Compensation
//                         & RIA Payment Services; Sales Enablement); cleanup
//                         flattens the per-<li> <h3>s to plain list text. It is a
//                         plain bulleted list (no descriptions), so it stays default
//                         content — NOT a cards block.
//   s4 Closing CTA     -> columns (text-only): "Find out more about Matrix Trust
//                         Company collective investment trusts" H2 + TALK TO US
//                         button. The CTA-line has no Divi columns, so columns.js
//                         emits a single text-only column and rewrites the button's
//                         href (#/javascript:void(0)) to #talk-to-us.
//   s5 Talk to Us form -> form-contact. #talk-to-us is a body-level modal; the
//                         sections transformer relocates it to the END before
//                         parsing so it lands last in document order.
const PAGE_TEMPLATE = {
  name: 'tpas-and-record-keepers',
  description: 'CIT TPAs & Recordkeepers page: hero-banner (H1 "TPAs & Recordkeepers" + subhead), intro/value-prop default content (paragraphs demoted from Divi <h3>: regulatory changes/shrinking margins, the automated mutual fund + ETF TrueOpen trading platform with 30,000+ funds; the "Eliminate the task…" callout heading; and the process-flow diagram image), services default content ("Satisfy the growing demand of customers." heading demoted from a second page <h1> to <h2>, a short prose line, and an 8-item plain bulleted service list authored as <li><h3> flattened to list text across two half-columns), columns (closing CTA, text-only, TALK TO US rewritten to #talk-to-us), form-contact (Talk to Us modal relocated to end). Shared header nav and footer chrome. Reuses the cit-landing/broker-dealer-platform parsers and transformers; adds no new blocks and has no cards on this page.',
  urls: [
    'https://www.broadridge.com/cit/tpas-and-record-keepers',
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
      name: 'Services',
      selector: ['#main-content > div.et_pb_section_2'],
      style: 'light-grey',
      blocks: [],
      defaultContent: ['#main-content > div.et_pb_section_2'],
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
    //    the final path segment (e.g. /cit/tpas-and-record-keepers ->
    //    tpas-and-record-keepers), so the content file is
    //    content/<slug>.plain.html. Falls back to /index when the URL has no path
    //    segment.
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
