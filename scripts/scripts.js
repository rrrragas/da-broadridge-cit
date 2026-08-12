import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  readBlockConfig,
  toClassName,
} from './aem.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * camelCase helper for section-metadata dataset keys.
 * @param {string} name
 */
function toCamelCaseKey(name) {
  return toClassName(name).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
}

/**
 * Applies section-metadata blocks to their section as classes/styles, then
 * removes the block. This repo's slim `aem.js` `decorateSections` does not
 * process `section-metadata`, so it is handled here (matching the boilerplate).
 * @param {Element} main The main element
 */
function decorateSectionMetadata(main) {
  main.querySelectorAll(':scope > .section > div > .section-metadata').forEach((metaBlock) => {
    const section = metaBlock.closest('.section');
    const meta = readBlockConfig(metaBlock);
    Object.keys(meta).forEach((key) => {
      if (key === 'style') {
        const styles = meta.style
          .split(',')
          .map((style) => toClassName(style.trim()))
          .filter((style) => style);
        styles.forEach((style) => section.classList.add(style));
      } else {
        section.dataset[toCamelCaseKey(key)] = meta[key];
      }
    });
    metaBlock.closest('.section-metadata-wrapper')?.remove();
    metaBlock.remove();
  });
}

/**
 * Consumes a page-level `metadata` block (Title/Description/Image/...) into the
 * document head and removes it. On the deployed pipeline this is done server
 * side; when serving `.plain.html` locally the block otherwise renders as
 * content and 404s trying to load a non-existent `metadata` block. Idempotent.
 * @param {Element} main The main element
 */
function decoratePageMetadata(main) {
  const metaBlock = main.querySelector(':scope > .section > div > .metadata');
  if (!metaBlock) return;
  const meta = readBlockConfig(metaBlock);
  if (meta.title && !document.title) document.title = meta.title;
  if (meta.description && !document.querySelector('meta[name="description"]')) {
    const m = document.createElement('meta');
    m.setAttribute('name', 'description');
    m.setAttribute('content', meta.description);
    document.head.append(m);
  }
  metaBlock.closest('.metadata-wrapper')?.remove();
  metaBlock.remove();
}

/**
 * Repoints "Talk to Us" CTAs at the on-page contact form (#talk-to-us).
 * The source authored these as modal triggers; the migrated content stores
 * `href="#talk-to-us"`, but the delivery pipeline strips a bare same-page
 * fragment to `/`. Re-set the href at runtime (matching by link text) so the
 * CTA scrolls to the form-contact block, which owns the `#talk-to-us` anchor.
 * @param {Element} scope The container to search (main, nav, etc.)
 */
function fixTalkToUsLinks(scope) {
  if (!scope) return;
  scope.querySelectorAll('a').forEach((a) => {
    if (a.textContent.trim().toLowerCase() !== 'talk to us') return;
    const href = a.getAttribute('href') || '';
    // only repoint links the pipeline flattened (root or empty) or explicit anchors
    if (href === '/' || href === '' || href === '#' || href.endsWith('#talk-to-us')) {
      a.setAttribute('href', '#talk-to-us');
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionMetadata(main);
  decoratePageMetadata(main);
  decorateBlocks(main);
  decorateButtons(main);
  fixTalkToUsLinks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const header = doc.querySelector('body > header');
  loadHeader(header);
  // repoint nav "Talk to Us" CTAs once the header block has loaded its content
  // (loadHeader is async and populates the nav after this call returns).
  if (header) {
    const observer = new MutationObserver(() => {
      if (header.querySelector('a')) {
        fixTalkToUsLinks(header);
        observer.disconnect();
      }
    });
    observer.observe(header, { childList: true, subtree: true });
  }

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
