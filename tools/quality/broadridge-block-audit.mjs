#!/usr/bin/env node
/**
 * broadridge-block-audit — live, multi-viewport QA sweep of migrated blocks vs. the legacy site.
 *
 * Unlike broadridge-visual-diff.mjs (a fast advisory hook that renders one block against a fixture
 * and a static baseline JSON, at one viewport), this script loads the REAL legacy page and the REAL
 * migrated page in a browser, at mobile/tablet/desktop, and reads actual computed styles from both
 * — so it can't go stale the way a hand-captured baseline can (see hero-banner subhead: only
 * visible on legacy at 2 of 3 viewports — a fixture render could never show that). It also computes
 * WCAG contrast ratios and hover-state changes, and reports which DOM element each measurement
 * actually came from (a selector that silently matches the wrong node was the biggest source of
 * bad data during manual investigation of this page).
 *
 * On-demand only (NOT a hook) — it hits an external site and loads 6 real pages per run, too slow
 * to fire on every edit. Run explicitly: `npm run broadridge:audit:blocks`.
 *
 * Usage:
 *   node tools/quality/broadridge-block-audit.mjs [options]
 * Options:
 *   --path <p>       page path (default /cit)
 *   --base <url>     legacy/source origin (default config.parityBase)
 *   --candidate <url> EDS/candidate origin (default config.localCandidate)
 *   --block <list>   comma-separated block names to audit (default: all specced blocks)
 *   --viewport <list> comma-separated viewport names (default: mobile,tablet,desktop)
 *   --out <file>     markdown report path (default tools/quality/visual-output/block-audit.md)
 *
 * Requires dev deps: playwright. Run browsers once: npx playwright install chromium
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  classify, contrastRatio, wcagAAThreshold, horizontalSide, auditSectionTransitions, layoutRelation, renderMode,
} from './lib/style-audit-utils.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('broadridge:audit:blocks needs playwright. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ROOT = process.cwd();
let config = {};
try { config = JSON.parse(readFileSync(join(ROOT, 'tools/quality/broadridge-visual.config.json'), 'utf8')); } catch { /* optional */ }

const path_ = arg('path', '/cit');
const base = (arg('base', config.parityBase) || '').replace(/\/+$/, '');
const candidate = (arg('candidate', config.localCandidate) || '').replace(/\/+$/, '');
const outDir = join(ROOT, 'tools/quality/visual-output');
const outFile = arg('out', join(outDir, 'block-audit.md'));

if (!base || !candidate) {
  console.error('No base/candidate URL — set parityBase/localCandidate in broadridge-visual.config.json or pass --base/--candidate.');
  process.exit(1);
}

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
};

// ---- Block specs: each knows how to find its own elements on the legacy page and the migrated
// page (the two DOMs are structurally unrelated — Divi markup vs. clean EDS markup — so a single
// generic selector can't cover both sides; that mismatch was the #1 cause of bad readings during
// manual investigation). captureLive/captureEds run inside the browser via page.evaluate and each
// return { info, props }: `info` names the matched element (for verifying the selector actually
// hit the right node) and is never diffed; `props` is a flat dot-path map that IS diffed.
const BLOCKS = {
  'hero-banner': {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const section = document.querySelector('.et_pb_fullwidth_header');
        const overlay = document.querySelector('.banner-overlay');
        const h1 = section && section.querySelector('h1');
        const sub = section && section.querySelector('.et_pb_fullwidth_header_subhead');
        const box = section.getBoundingClientRect();
        const subBox = sub ? sub.getBoundingClientRect() : null;
        return {
          info: {
            root: `${section.tagName}.${section.className}`.slice(0, 60),
            h1: h1 ? h1.tagName : 'missing',
            sub: sub ? `${sub.tagName}.${sub.className}` : 'missing',
          },
          props: {
            sectionHeight: Math.round(box.height),
            padding: g(section, 'padding'),
            backgroundPosition: g(section, 'background-position'),
            overlayColor: overlay ? g(overlay, 'background-color') : null,
            'h1.fontSize': h1 && g(h1, 'font-size'),
            'h1.marginBottom': h1 && g(h1, 'margin-bottom'),
            'h1.color': h1 && g(h1, 'color'),
            subVisible: sub ? String(!!(subBox && subBox.width > 0 && subBox.height > 0 && g(sub, 'display') !== 'none')) : 'missing',
            'sub.fontSize': sub && g(sub, 'font-size'),
            'sub.fontWeight': sub && g(sub, 'font-weight'),
            'sub.lineHeight': sub && g(sub, 'line-height'),
          },
        };
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const gAfter = (el, p) => (el ? getComputedStyle(el, '::after').getPropertyValue(p) : null);
        const block = document.querySelector('.hero-banner');
        const h1 = block && block.querySelector('h1');
        const sub = block && block.querySelector('p');
        const img = block && block.querySelector('img');
        const box = block.getBoundingClientRect();
        const subBox = sub ? sub.getBoundingClientRect() : null;
        return {
          info: {
            root: `${block.tagName}.${block.className}`.slice(0, 60),
            h1: h1 ? h1.tagName : 'missing',
            sub: sub ? sub.tagName : 'missing',
          },
          props: {
            sectionHeight: Math.round(box.height),
            padding: g(block, 'padding'),
            backgroundPosition: img && g(img, 'object-position'),
            overlayColor: gAfter(block, 'background-image'),
            'h1.fontSize': h1 && g(h1, 'font-size'),
            'h1.marginBottom': h1 && g(h1, 'margin-bottom'),
            'h1.color': h1 && g(h1, 'color'),
            subVisible: sub ? String(!!(subBox && subBox.width > 0 && subBox.height > 0 && g(sub, 'display') !== 'none')) : 'missing',
            'sub.fontSize': sub && g(sub, 'font-size'),
            'sub.fontWeight': sub && g(sub, 'font-weight'),
            'sub.lineHeight': sub && g(sub, 'line-height'),
          },
        };
      });
    },
    contrastPairs: [
      { label: 'h1 vs overlay (approx — real bg is a photo)', textProp: 'h1.color', bgProp: 'overlayColor', fontSizeProp: 'h1.fontSize' },
    ],
  },

  cards: {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        ['welcomelink1', 'welcomelink2'].forEach((cls, i) => {
          const a = document.querySelector(`.${cls}`);
          const key = `card${i + 1}`;
          if (!a) { out.info[key] = 'not found'; return; }
          const wrapper = a.querySelector('.et_pb_module') || a;
          const inner = wrapper.querySelector('.et_pb_text_inner') || wrapper;
          const h4 = inner.querySelector('h4');
          // legacy body copy isn't reliably a <p> — take any sibling of the heading with text.
          const p = [...inner.children].find((el) => el !== h4 && el.textContent.trim().length > 0) || inner.querySelector('p');
          const box = wrapper.getBoundingClientRect();
          out.info[key] = `${a.tagName}.${a.className}`;
          out.props[`${key}.bg`] = g(wrapper, 'background-color');
          out.props[`${key}.padding`] = g(wrapper, 'padding');
          out.props[`${key}.height`] = Math.round(box.height);
          out.props[`${key}.title.fontSize`] = h4 && g(h4, 'font-size');
          out.props[`${key}.title.fontWeight`] = h4 && g(h4, 'font-weight');
          out.props[`${key}.title.color`] = h4 && g(h4, 'color');
          out.props[`${key}.body.fontSize`] = p && g(p, 'font-size');
          out.props[`${key}.body.color`] = p && g(p, 'color');
        });
        return out;
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const items = document.querySelectorAll('.cards.feature > ul > li');
        const out = { info: {}, props: {} };
        items.forEach((li, i) => {
          const key = `card${i + 1}`;
          const h3 = li.querySelector('h1,h2,h3,h4,h5,h6');
          const p = li.querySelector('p');
          const body = li.querySelector('.cards-card-body');
          const box = li.getBoundingClientRect();
          out.info[key] = `${li.tagName}.${li.className}`;
          out.props[`${key}.bg`] = g(li, 'background-color');
          out.props[`${key}.padding`] = g(body || li, 'padding');
          out.props[`${key}.height`] = Math.round(box.height);
          out.props[`${key}.title.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${key}.title.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${key}.title.color`] = h3 && g(h3, 'color');
          out.props[`${key}.body.fontSize`] = p && g(p, 'font-size');
          out.props[`${key}.body.color`] = p && g(p, 'color');
        });
        return out;
      });
    },
    contrastPairs: [
      { label: 'card1 title vs tile', textProp: 'card1.title.color', bgProp: 'card1.bg', fontSizeProp: 'card1.title.fontSize' },
      { label: 'card1 body vs tile', textProp: 'card1.body.color', bgProp: 'card1.bg', fontSizeProp: 'card1.body.fontSize' },
    ],
    hover: [
      { side: 'eds', selector: '.cards.feature > ul > li', prop: 'background-color' },
      { side: 'live', selector: '.welcomelink1', prop: 'background-color' },
    ],
  },

  columns: {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        const cols = document.querySelectorAll('.et_pb_row_4 .et_pb_column');
        [['positive', cols[0]], ['negative', cols[1]]].forEach(([label, col]) => {
          if (!col) { out.info[label] = 'not found'; return; }
          const h3 = col.querySelector('h3');
          const li = col.querySelector('li');
          out.info[label] = `${col.tagName}.${col.className}`.slice(0, 60);
          out.props[`${label}.heading.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${label}.heading.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${label}.heading.color`] = h3 && g(h3, 'color');
          out.props[`${label}.li.fontSize`] = li && g(li, 'font-size');
          out.props[`${label}.li.color`] = li && g(li, 'color');
          out.props[`${label}.marker.content`] = li && getComputedStyle(li, '::before').content;
          out.props[`${label}.marker.color`] = li && getComputedStyle(li, '::before').color;
        });
        return out;
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const out = { info: {}, props: {} };
        [['positive', '.columns.compare .columns-positive'], ['negative', '.columns.compare .columns-negative']].forEach(([label, sel]) => {
          const col = document.querySelector(sel);
          if (!col) { out.info[label] = 'not found'; return; }
          const h3 = col.querySelector('h1,h2,h3,h4');
          const li = col.querySelector('li');
          out.info[label] = `${col.tagName}.${col.className}`.slice(0, 60);
          out.props[`${label}.heading.fontSize`] = h3 && g(h3, 'font-size');
          out.props[`${label}.heading.fontWeight`] = h3 && g(h3, 'font-weight');
          out.props[`${label}.heading.color`] = h3 && g(h3, 'color');
          out.props[`${label}.li.fontSize`] = li && g(li, 'font-size');
          out.props[`${label}.li.color`] = li && g(li, 'color');
          out.props[`${label}.marker.content`] = li && getComputedStyle(li, '::before').content;
          out.props[`${label}.marker.color`] = li && getComputedStyle(li, '::before').color;
        });
        return out;
      });
    },
    contrastPairs: [
      { label: 'positive text vs section bg', textProp: 'positive.li.color', bgProp: '__sectionBg', fontSizeProp: 'positive.li.fontSize' },
    ],
    // sections.characteristics background from source-baseline.json — flat color, safe to hardcode
    // here since it's a fixed design token, not something that varies per block.
    fixedProps: { __sectionBg: 'rgb(240, 242, 246)' },
  },

  'form-contact': {
    async captureLive(page) {
      try {
        const trigger = page.locator('.open-talk-to-us a, a:has-text("TALK TO US")').first();
        if (await trigger.count()) { await trigger.click({ timeout: 5000 }); await page.waitForTimeout(600); }
      } catch { /* modal trigger not found — capture will show button as 'not found' */ }
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const btn = document.querySelector('.form__field__input--button');
        const label = document.querySelector('.talk-to-us__form label, .form__field label');
        return {
          info: {
            button: btn ? `${btn.tagName}.${btn.className}`.slice(0, 60) : 'not found (modal may not have opened)',
            label: label ? `${label.tagName}.${label.className}` : 'not found',
          },
          props: {
            'button.bg': btn && g(btn, 'background-color'),
            'button.color': btn && g(btn, 'color'),
            'button.borderRadius': btn && g(btn, 'border-radius'),
            'button.padding': btn && g(btn, 'padding'),
            'button.fontWeight': btn && g(btn, 'font-weight'),
            'button.fontSize': btn && g(btn, 'font-size'),
            'label.fontSize': label && g(label, 'font-size'),
            'label.fontWeight': label && g(label, 'font-weight'),
            'label.color': label && g(label, 'color'),
            hasSemanticLabel: String(!!label),
          },
        };
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const btn = document.querySelector('.form-contact-submit');
        const label = document.querySelector('.form-contact-field label');
        return {
          info: {
            button: btn ? `${btn.tagName}.${btn.className}` : 'not found',
            label: label ? `${label.tagName}.${label.className}` : 'not found',
          },
          props: {
            'button.bg': btn && g(btn, 'background-color'),
            'button.color': btn && g(btn, 'color'),
            'button.borderRadius': btn && g(btn, 'border-radius'),
            'button.padding': btn && g(btn, 'padding'),
            'button.fontWeight': btn && g(btn, 'font-weight'),
            'button.fontSize': btn && g(btn, 'font-size'),
            'label.fontSize': label && g(label, 'font-size'),
            'label.fontWeight': label && g(label, 'font-weight'),
            'label.color': label && g(label, 'color'),
            hasSemanticLabel: String(!!label),
          },
        };
      });
    },
    contrastPairs: [
      { label: 'button text vs button bg', textProp: 'button.color', bgProp: 'button.bg', fontSizeProp: 'button.fontSize', fontWeightProp: 'button.fontWeight' },
    ],
    hover: [
      { side: 'eds', selector: '.form-contact-submit', prop: 'background-color' },
      { side: 'live', selector: '.form__field__input--button', prop: 'background-color' },
    ],
  },

  // header: fragment-loaded nav. Beyond colors/type this also measures element
  // ALIGNMENT (which side of the bar the logo and hamburger sit on) — a mirrored
  // mobile layout is invisible to a property-only diff, and was missed manually.
  header: {
    async captureLive(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const bar = document.querySelector('header');
        const barBox = bar ? bar.getBoundingClientRect() : null;
        const logo = bar && bar.querySelector('img');
        // resting (non-active) top-level nav link + the active/current one
        const links = bar ? [...bar.querySelectorAll('#et-top-navigation a, .et-menu a, nav a')].filter((a) => a.textContent.trim()) : [];
        const resting = links.find((a) => !/active|current/i.test(a.className) && !/active|current/i.test(a.closest('li')?.className || ''));
        const active = links.find((a) => /active|current/i.test(a.className) || /active|current/i.test(a.closest('li')?.className || ''));
        // hamburger toggle (mobile)
        const burger = bar && bar.querySelector('.mobile_nav, .mobile_menu_bar, [class*="hamburger" i], .et_pb_menu__toggle');
        const centerX = (el) => { const b = el && el.getBoundingClientRect(); return b ? b.x + b.width / 2 : null; };
        return {
          info: {
            root: bar ? `${bar.tagName}` : 'missing',
            active: active ? active.textContent.trim().slice(0, 16) : 'none',
          },
          props: {
            barBg: bar && g(bar, 'background-color'),
            barHeight: barBox ? Math.round(barBox.height) : null,
            logoWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
            'restingLink.color': resting && g(resting, 'color'),
            'restingLink.fontWeight': resting && g(resting, 'font-weight'),
            'activeLink.color': active && g(active, 'color'),
            logoCenterX: logo ? Math.round(centerX(logo)) : null,
            hamburgerCenterX: burger ? Math.round(centerX(burger)) : null,
            barCenterX: barBox ? Math.round(barBox.x + barBox.width / 2) : null,
          },
        };
      });
    },
    async captureEds(page) {
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        const host = document.querySelector('header');
        const bar = host && (host.querySelector('.nav-wrapper') || host);
        const barBox = bar ? bar.getBoundingClientRect() : null;
        const logo = host && host.querySelector('.nav-brand img');
        const links = host ? [...host.querySelectorAll('.nav-sections a')].filter((a) => a.textContent.trim()) : [];
        const resting = links.find((a) => !a.classList.contains('nav-active'));
        const active = links.find((a) => a.classList.contains('nav-active'));
        const burger = host && host.querySelector('.nav-hamburger');
        const centerX = (el) => { const b = el && el.getBoundingClientRect(); return b ? b.x + b.width / 2 : null; };
        return {
          info: {
            root: bar ? `${bar.tagName}.${bar.className}`.slice(0, 40) : 'missing',
            active: active ? active.textContent.trim().slice(0, 16) : 'none',
          },
          props: {
            barBg: bar && g(bar, 'background-color'),
            barHeight: barBox ? Math.round(barBox.height) : null,
            logoWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
            'restingLink.color': resting && g(resting, 'color'),
            'restingLink.fontWeight': resting && g(resting, 'font-weight'),
            'activeLink.color': active && g(active, 'color'),
            logoCenterX: logo ? Math.round(centerX(logo)) : null,
            hamburgerCenterX: burger ? Math.round(centerX(burger)) : null,
            barCenterX: barBox ? Math.round(barBox.x + barBox.width / 2) : null,
          },
        };
      });
    },
    // which side of the bar each element sits on — flagged when the sides disagree
    alignmentPairs: [
      { label: 'logo', centerProp: 'logoCenterX', barProp: 'barCenterX' },
      { label: 'hamburger', centerProp: 'hamburgerCenterX', barProp: 'barCenterX' },
    ],
    contrastPairs: [
      { label: 'resting nav link vs bar', textProp: 'restingLink.color', bgProp: 'barBg', fontSizeProp: 'restingLink.fontSize', fontWeightProp: 'restingLink.fontWeight' },
    ],
  },

  // footer: fragment-loaded. Captured element-by-element the way a QA reviewer
  // works down a component — the navy bar, each link-group heading, the nav
  // links, the copyright/legal line, and the darker social sub-bar — with a full
  // property set per element (color, size, weight, transform, decoration).
  footer: {
    async captureLive(page) {
      // footer is below the fold — scroll so lazy content/styles resolve.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        // background of an element OR its ::before/::after — full-bleed sub-bars are
        // often drawn with a pseudo-element, which getComputedStyle(el) alone misses.
        const bandBg = (el) => {
          if (!el) return null;
          const solid = (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
          const own = getComputedStyle(el).backgroundColor;
          if (solid(own)) return own;
          for (const pe of ['::before', '::after']) {
            const c = getComputedStyle(el, pe).getPropertyValue('background-color');
            if (solid(c)) return c;
          }
          return null;
        };
        const f = document.querySelector('footer, .footer, #footer');
        // the navy bar is the main-nav band on the source (footer itself is transparent)
        const bar = (f && f.querySelector('.footer__main-nav')) || f;
        const heading = f && f.querySelector('.footer__nav-links__item__title');
        const link = f && [...f.querySelectorAll('.footer__nav-links a, .footer__main-nav a')].find((a) => a.textContent.trim());
        const copyright = f && f.querySelector('.footer__copyright');
        const social = f && f.querySelector('.footer__social-nav');
        // composition: description region + link-columns region (relative layout)
        const desc = f && f.querySelector('.footer__contact');
        const links = f && f.querySelector('.footer__nav-links');
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const socialA = f && f.querySelector('.footer__social-nav a');
        const socialInner = socialA ? (socialA.querySelector('svg, img, i') || socialA) : null;
        return {
          info: {
            root: f ? `${f.tagName}.${f.className}`.slice(0, 40) : 'missing',
            heading: heading ? heading.textContent.trim().slice(0, 24) : 'none',
          },
          regions: { desc: box(desc), links: box(links) },
          social: socialA ? {
            tag: socialInner ? socialInner.tagName.toLowerCase() : 'a',
            hasImg: !!(socialA.querySelector('img')),
            hasSvg: !!(socialA.querySelector('svg')),
            beforeContent: socialInner ? getComputedStyle(socialInner, '::before').content : 'none',
            text: socialA.textContent.trim(),
          } : null,
          props: {
            barBg: g(bar, 'background-color'),
            'heading.color': heading && g(heading, 'color'),
            'heading.fontSize': heading && g(heading, 'font-size'),
            'heading.fontWeight': heading && g(heading, 'font-weight'),
            'heading.textTransform': heading && g(heading, 'text-transform'),
            'link.color': link && g(link, 'color'),
            'link.fontSize': link && g(link, 'font-size'),
            'link.textDecoration': link && g(link, 'text-decoration-line'),
            'copyright.color': copyright && g(copyright, 'color'),
            'copyright.fontSize': copyright && g(copyright, 'font-size'),
            'copyright.textAlign': copyright && g(copyright, 'text-align'),
            socialBarBg: bandBg(social),
          },
        };
      });
    },
    async captureEds(page) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      return page.evaluate(() => {
        const g = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
        // background of an element OR its ::before/::after — full-bleed sub-bars are
        // often drawn with a pseudo-element, which getComputedStyle(el) alone misses.
        const bandBg = (el) => {
          if (!el) return null;
          const solid = (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
          const own = getComputedStyle(el).backgroundColor;
          if (solid(own)) return own;
          for (const pe of ['::before', '::after']) {
            const c = getComputedStyle(el, pe).getPropertyValue('background-color');
            if (solid(c)) return c;
          }
          return null;
        };
        const f = document.querySelector('footer');
        // EDS puts the navy on the footer element itself
        const bar = f;
        const heading = f && f.querySelector('.footer-link-group h1, .footer-link-group h2, .footer-link-group h3, .footer-link-group h4, .footer-link-group h5, .footer-link-group h6');
        const link = f && [...f.querySelectorAll('.footer-nav a')].find((a) => a.textContent.trim());
        // copyright/legal row: the second default-content-wrapper (legal placeholders live here)
        const copyright = f && (f.querySelector('.footer-legal-placeholder')?.closest('p, div') || f.querySelectorAll('.default-content-wrapper')[1]);
        // EDS social sub-bar: a dedicated darker band, or the bottom row's pseudo band.
        const social = f && (f.querySelector('.footer-social-bar') || f.querySelector('.footer-bottom'));
        // composition: description region + link-columns region (relative layout)
        const desc = f && (f.querySelector('.footer-brand-intro') || null);
        const links = f && (f.querySelector('.footer-nav') || null);
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const socialA = f && f.querySelector('a.footer-social-link');
        const socialInner = socialA ? (socialA.querySelector('svg, img, i') || socialA) : null;
        return {
          info: {
            root: bar ? `${bar.tagName}.${bar.className}`.slice(0, 40) : 'missing',
            heading: heading ? heading.textContent.trim().slice(0, 24) : 'none',
          },
          regions: { desc: box(desc), links: box(links) },
          social: socialA ? {
            tag: socialInner ? socialInner.tagName.toLowerCase() : 'a',
            hasImg: !!(socialA.querySelector('img')),
            hasSvg: !!(socialA.querySelector('svg')),
            beforeContent: socialInner ? getComputedStyle(socialInner, '::before').content : 'none',
            text: socialA.textContent.trim(),
          } : null,
          props: {
            barBg: g(bar, 'background-color'),
            'heading.color': heading && g(heading, 'color'),
            'heading.fontSize': heading && g(heading, 'font-size'),
            'heading.fontWeight': heading && g(heading, 'font-weight'),
            'heading.textTransform': heading && g(heading, 'text-transform'),
            'link.color': link && g(link, 'color'),
            'link.fontSize': link && g(link, 'font-size'),
            'link.textDecoration': link && g(link, 'text-decoration-line'),
            'copyright.color': copyright && g(copyright, 'color'),
            'copyright.fontSize': copyright && g(copyright, 'font-size'),
            'copyright.textAlign': copyright && g(copyright, 'text-align'),
            socialBarBg: bandBg(social),
          },
        };
      });
    },
    contrastPairs: [
      { label: 'nav link vs bar', textProp: 'link.color', bgProp: 'barBg', fontSizeProp: 'link.fontSize' },
      { label: 'heading vs bar', textProp: 'heading.color', bgProp: 'barBg', fontSizeProp: 'heading.fontSize', fontWeightProp: 'heading.fontWeight' },
    ],
    hover: [
      { side: 'eds', selector: '.footer-nav a', prop: 'color' },
      { side: 'live', selector: '.footer__nav-links a', prop: 'color' },
    ],
    // composition checks (invisible to property diffs): are the link columns
    // BESIDE the description (source) or stacked BELOW it (regression)? and are
    // the social links rendered as icons (source) or plain text (regression)?
    regionPairs: [
      { label: 'link-columns vs description', a: 'desc', b: 'links' },
    ],
    renderModeOf: 'social links (icon vs text)',
  },
};

const selectedBlocks = (arg('block') || Object.keys(BLOCKS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const selectedViewports = (arg('viewport') || Object.keys(VIEWPORTS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);

for (const b of selectedBlocks) {
  if (!BLOCKS[b]) { console.error(`Unknown block "${b}". Known: ${Object.keys(BLOCKS).join(', ')}`); process.exit(1); }
}
for (const v of selectedViewports) {
  if (!VIEWPORTS[v]) { console.error(`Unknown viewport "${v}". Known: ${Object.keys(VIEWPORTS).join(', ')}`); process.exit(1); }
}

const results = {}; // { block: { viewport: { liveInfo, edsInfo, rows, contrastRows, hoverRows } } }
const sectionAudit = {}; // { viewport: [issues] } — page-level section-transition smells (EDS side)
const browser = await chromium.launch();

try {
  for (const vpName of selectedViewports) {
    const vp = VIEWPORTS[vpName];
    const livePage = await browser.newPage();
    const edsPage = await browser.newPage();
    await livePage.setViewportSize(vp);
    await edsPage.setViewportSize(vp);
    await livePage.goto(`${base}${path_}`, { waitUntil: 'networkidle', timeout: 30000 });
    await livePage.waitForTimeout(1000);
    // Dismiss the legacy cookie-consent banner — left open it overlaps content and blocks
    // Playwright's actionability checks (hover/click), causing spurious timeouts on the source side.
    try {
      const cookieBtn = livePage.locator('button:has-text("Accept all cookies")').first();
      if (await cookieBtn.count()) { await cookieBtn.click({ timeout: 3000 }); await livePage.waitForTimeout(300); }
    } catch { /* banner not present at this viewport/run — fine */ }
    await edsPage.goto(`${candidate}${path_}`, { waitUntil: 'networkidle', timeout: 30000 });
    await edsPage.waitForTimeout(1000);

    // Page-level section-transition audit (EDS side): catches unintended white
    // bands between sections and empty leftover section shells — layout smells
    // the per-block property diff can't see.
    try {
      const sections = await edsPage.evaluate(() => [...document.querySelectorAll('main > .section')].map((s) => {
        const cs = getComputedStyle(s);
        const box = s.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          height: box.height,
          bg: cs.backgroundColor,
          marginTop: parseFloat(cs.marginTop) || 0,
          marginBottom: parseFloat(cs.marginBottom) || 0,
          empty: s.children.length === 0 && s.textContent.trim() === '',
        };
      }));
      sectionAudit[vpName] = auditSectionTransitions(sections);
    } catch { sectionAudit[vpName] = []; }

    for (const blockName of selectedBlocks) {
      const spec = BLOCKS[blockName];
      let live;
      let eds;
      try {
        live = await spec.captureLive(livePage);
      } catch (e) { live = { info: { error: e.message.split('\n')[0] }, props: {} }; }
      try {
        eds = await spec.captureEds(edsPage);
      } catch (e) { eds = { info: { error: e.message.split('\n')[0] }, props: {} }; }

      const liveProps = { ...(spec.fixedProps || {}), ...live.props };
      const edsProps = { ...(spec.fixedProps || {}), ...eds.props };

      const keys = new Set([...Object.keys(liveProps), ...Object.keys(edsProps)]);
      const rows = [];
      for (const k of keys) {
        if (k.startsWith('__')) continue; // internal fixed-prop, not a real measured property
        const lv = liveProps[k];
        const ev = edsProps[k];
        if (lv == null && ev == null) continue;
        if (String(lv) === String(ev)) continue;
        rows.push({ prop: k, source: String(lv), migrated: String(ev), ...classify(k, lv, ev) });
      }

      const contrastRows = [];
      for (const pair of spec.contrastPairs || []) {
        for (const [sideLabel, props] of [['source', liveProps], ['migrated', edsProps]]) {
          const textColor = props[pair.textProp];
          const bgColor = pair.bgProp.startsWith('__') ? props[pair.bgProp] : props[pair.bgProp];
          const ratio = contrastRatio(textColor, bgColor);
          if (ratio == null) {
            contrastRows.push({ label: pair.label, side: sideLabel, ratio: 'n/a', note: 'non-flat or unparseable color' });
            continue;
          }
          const threshold = wcagAAThreshold(props[pair.fontSizeProp], props[pair.fontWeightProp]);
          contrastRows.push({
            label: pair.label, side: sideLabel, ratio: ratio.toFixed(2), threshold, pass: ratio >= threshold,
          });
        }
      }

      const hoverRows = [];
      if (vpName === 'desktop') { // hover state doesn't meaningfully vary by viewport — check once
        for (const h of spec.hover || []) {
          const targetPage = h.side === 'eds' ? edsPage : livePage;
          // honor the property each spec declares (footer links change `color`,
          // cards/buttons change `background-color`); default keeps old behavior.
          const cssProp = h.prop || 'background-color';
          try {
            const read = (sel, prop) => targetPage.evaluate(([s, p]) => {
              const el = document.querySelector(s);
              return el ? getComputedStyle(el).getPropertyValue(p) : null;
            }, [sel, prop]);
            const before = await read(h.selector, cssProp);
            await targetPage.hover(h.selector, { timeout: 3000 });
            await targetPage.waitForTimeout(250);
            const after = await read(h.selector, cssProp);
            hoverRows.push({
              side: h.side, selector: h.selector, prop: cssProp, before, after, changed: before !== after,
            });
          } catch (e) {
            hoverRows.push({ side: h.side, selector: h.selector, prop: cssProp, error: e.message.split('\n')[0] });
          }
        }
      }

      // Alignment: compare which side of the bar each element sits on. A mirrored
      // layout (e.g. mobile hamburger left vs right) is invisible to a property diff.
      const alignmentRows = [];
      for (const a of spec.alignmentPairs || []) {
        const srcSide = horizontalSide(liveProps[a.centerProp], liveProps[a.barProp]);
        const migSide = horizontalSide(edsProps[a.centerProp], edsProps[a.barProp]);
        if (srcSide == null && migSide == null) continue;
        alignmentRows.push({
          label: a.label, source: srcSide || 'n/a', migrated: migSide || 'n/a', mismatch: srcSide !== migSide,
        });
      }

      // Composition: relative layout of two regions (e.g. links BESIDE vs BELOW
      // description) + render mode (icon vs text). Both are invisible to a
      // property-level diff — they were the footer gaps that slipped through.
      const layoutRows = [];
      if (spec.regionPairs && (live.regions || eds.regions)) {
        for (const rp of spec.regionPairs) {
          const srcRel = layoutRelation(live.regions?.[rp.a], live.regions?.[rp.b]);
          const migRel = layoutRelation(eds.regions?.[rp.a], eds.regions?.[rp.b]);
          if (srcRel == null && migRel == null) continue;
          layoutRows.push({
            label: rp.label, source: srcRel || 'n/a', migrated: migRel || 'n/a', mismatch: srcRel !== migRel,
          });
        }
      }
      if (spec.renderModeOf && (live.social || eds.social)) {
        const srcMode = live.social ? renderMode(live.social) : 'n/a';
        const migMode = eds.social ? renderMode(eds.social) : 'n/a';
        layoutRows.push({
          label: spec.renderModeOf, source: srcMode, migrated: migMode, mismatch: srcMode !== migMode,
        });
      }

      results[blockName] = results[blockName] || {};
      results[blockName][vpName] = {
        liveInfo: live.info, edsInfo: eds.info, rows, contrastRows, hoverRows, alignmentRows, layoutRows,
      };
    }
    await livePage.close();
    await edsPage.close();
  }
} finally {
  await browser.close();
}

// ---- report ----
let md = `# Block audit — ${path_}\n\nSource: ${base}${path_}\nMigrated: ${candidate}${path_}\nViewports: ${selectedViewports.join(', ')}\n\nLegend: 🔴 clear divergence · 🟡 minor · 🟢 negligible\n\n`;
let totalFlagged = 0;
let totalContrastFail = 0;
let totalMisaligned = 0;
let totalLayoutIssues = 0;

for (const blockName of selectedBlocks) {
  md += `## ${blockName}\n\n`;
  const firstVp = results[blockName][selectedViewports[0]];
  md += `**Matched elements** — source: \`${JSON.stringify(firstVp.liveInfo)}\`  \nmigrated: \`${JSON.stringify(firstVp.edsInfo)}\`\n\n`;

  for (const vpName of selectedViewports) {
    const r = results[blockName][vpName];
    md += `### ${vpName}\n\n`;
    if (r.rows.length) {
      totalFlagged += r.rows.filter((row) => row.icon !== '🟢').length;
      md += '| Property | Source | Migrated | Severity |\n|---|---|---|---|\n';
      for (const row of r.rows) md += `| ${row.prop} | ${row.source} | ${row.migrated} | ${row.icon} ${row.label} |\n`;
      md += '\n';
    } else {
      md += '✓ no differences\n\n';
    }
    if (r.contrastRows.length) {
      md += '**Contrast**\n\n| Pair | Side | Ratio | Threshold | Result |\n|---|---|---|---|---|\n';
      for (const c of r.contrastRows) {
        const result = c.pass === undefined ? (c.note || '—') : (c.pass ? '✅ pass' : '❌ FAIL');
        if (c.pass === false) totalContrastFail += 1;
        md += `| ${c.label} | ${c.side} | ${c.ratio} | ${c.threshold ? `${c.threshold}:1` : '—'} | ${result} |\n`;
      }
      md += '\n';
    }
    if (r.alignmentRows && r.alignmentRows.length) {
      md += '**Alignment (which side of the bar)**\n\n| Element | Source | Migrated | Result |\n|---|---|---|---|\n';
      for (const a of r.alignmentRows) {
        if (a.mismatch) totalMisaligned += 1;
        md += `| ${a.label} | ${a.source} | ${a.migrated} | ${a.mismatch ? '🔴 mirrored' : '✅ same side'} |\n`;
      }
      md += '\n';
    }
    if (r.layoutRows && r.layoutRows.length) {
      md += '**Layout composition (relative position / render mode)**\n\n| Aspect | Source | Migrated | Result |\n|---|---|---|---|\n';
      for (const l of r.layoutRows) {
        if (l.mismatch) totalLayoutIssues += 1;
        md += `| ${l.label} | ${l.source} | ${l.migrated} | ${l.mismatch ? '🔴 differs' : '✅ same'} |\n`;
      }
      md += '\n';
    }
    if (r.hoverRows.length) {
      md += '**Hover state (desktop)**\n\n| Side | Selector | Property | Before | After | Changed |\n|---|---|---|---|---|---|\n';
      for (const h of r.hoverRows) {
        md += `| ${h.side} | \`${h.selector}\` | ${h.prop || 'background-color'} | ${h.before || h.error || 'n/a'} | ${h.after || ''} | ${h.error ? '⚠️ error' : (h.changed ? '✅ yes' : '— no change')} |\n`;
      }
      md += '\n';
    }
  }
}

// ---- page-level section transitions (once per viewport, EDS side) ----
let totalSectionIssues = 0;
const hasSectionIssues = Object.values(sectionAudit).some((list) => list && list.length);
if (hasSectionIssues) {
  md += '## page: section transitions\n\n';
  for (const vpName of selectedViewports) {
    const issues = sectionAudit[vpName] || [];
    md += `### ${vpName}\n\n`;
    if (!issues.length) { md += '✓ no gaps or empty-section artifacts\n\n'; continue; }
    md += '| Kind | Where | Severity | Detail |\n|---|---|---|---|\n';
    for (const i of issues) {
      totalSectionIssues += 1;
      md += `| ${i.kind} | ${i.between || `#${i.at}`} | ${i.severity} | ${i.detail} |\n`;
    }
    md += '\n';
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, md);
console.log(md);
console.log(`Full report written to ${outFile}`);
console.log(`\n${totalFlagged} non-negligible propert${totalFlagged === 1 ? 'y' : 'ies'} differ across ${selectedBlocks.length} block(s) × ${selectedViewports.length} viewport(s); ${totalContrastFail} contrast check(s) FAILED WCAG AA; ${totalMisaligned} alignment mismatch(es); ${totalLayoutIssues} layout-composition issue(s); ${totalSectionIssues} section-transition issue(s).`);
process.exit(0); // advisory — on-demand report, never blocks
