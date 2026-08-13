#!/usr/bin/env node
/**
 * Extract design tokens from every page of the broadridge.com/cit microsite.
 * Visits each page at desktop + mobile, reads computed styles from a representative
 * set of elements, and aggregates by frequency into a token report.
 *
 * On-demand only. Run: node tools/quality/cit-token-extract.mjs
 * Output: tools/quality/visual-output/cit-tokens-raw.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE = 'https://www.broadridge.com';
const PATHS = [
  '/cit/',
  '/cit/about-us',
  '/cit/banks-and-trusts',
  '/cit/broker-dealer-platform',
  '/cit/cit-services',
  '/cit/financial-advisers',
  '/cit/matrix-cits',
  '/cit/tpas-and-record-keepers',
  '/cit/terms-and-conditions',
  // fund detail pages (the 22 share one template)
  '/cit/commerce-core-bond-cit',
  '/cit/donaldson-preservation-fund',
  '/cit/donaldson-rising-dividend-fund',
  '/cit/donaldson-sequoia-fund',
  '/cit/equity-armor-cits',
  '/cit/goalpath-portfolios',
  '/cit/highland-capital-management-core-fixed-fund',
  '/cit/highland-capital-management-smid-cap-core-alpha-fund',
  '/cit/managed-retirement-funds',
  '/cit/matrix-trust-multi-manager-stable-value-fund',
  '/cit/mtc-northern-trust',
  '/cit/mutual-of-america-stable-value-cit',
  '/cit/pacific-life-income-horizon-cits',
  '/cit/pacific-ridge-small-cap-value',
  '/cit/retirement-advocate-funds',
  '/cit/starpath-funds',
  '/cit/strategic-roadmap-portfolios',
  '/cit/twelve-points-retirement-advisors-100-percent-equity-fund',
  '/cit/twelve-points-target-risk-portfolios',
  '/cit/wealthplan-partners-dividend-aristocrats-portfolio-fund',
  '/cit/xponance-inc-small-cap-core-equity-smid-cap-core-equity-funds',
  '/cit/xponance-inc-yield-advantage-opportunistic-core-bond-fund',
];

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1280, height: 900 },
};

// Runs in the browser: harvest computed styles across the whole document.
function harvest() {
  const norm = (c) => (c || '').trim().toLowerCase();
  const bump = (map, key, sample) => {
    if (!key || key === 'none' || key === 'normal') return;
    if (!map[key]) map[key] = { count: 0, samples: [] };
    map[key].count += 1;
    if (sample && map[key].samples.length < 4 && !map[key].samples.includes(sample)) {
      map[key].samples.push(sample);
    }
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05;
  };

  const out = {
    colorText: {}, colorBg: {}, colorBorder: {},
    fontFamily: {}, fontSize: {}, fontWeight: {}, lineHeight: {},
    borderRadius: {}, letterSpacing: {},
    linkColor: {}, buttons: [], headings: {},
  };

  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    if (!isVisible(el)) continue;
    const s = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const label = `${tag}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : ''}`;
    const text = (el.textContent || '').trim().slice(0, 30);

    bump(out.colorText, norm(s.color), label);
    const bg = norm(s.backgroundColor);
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') bump(out.colorBg, bg, label);
    ['borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'].forEach((bp) => {
      const bw = parseFloat(s[bp.replace('Color', 'Width')]);
      if (bw > 0) bump(out.colorBorder, norm(s[bp]), label);
    });

    bump(out.fontFamily, norm(s.fontFamily), label);
    if (text.length > 0) {
      bump(out.fontSize, s.fontSize, `${label}:"${text}"`);
      bump(out.fontWeight, s.fontWeight, label);
      bump(out.lineHeight, s.lineHeight, label);
      if (s.letterSpacing !== 'normal') bump(out.letterSpacing, s.letterSpacing, label);
    }

    const radius = s.borderRadius;
    if (radius && radius !== '0px') bump(out.borderRadius, radius, label);

    if (tag === 'a' && text.length > 0) bump(out.linkColor, norm(s.color), `${label}:"${text}"`);

    if (/^h[1-6]$/.test(tag) && text.length > 0) {
      const key = tag;
      if (!out.headings[key]) out.headings[key] = {};
      const sig = `${s.fontSize}|${s.fontWeight}|${s.lineHeight}|${norm(s.color)}|${s.letterSpacing}`;
      bump(out.headings[key], sig, text);
    }

    const looksButton = tag === 'button'
      || (tag === 'a' && (/btn|button|cta/i.test(el.className || '')))
      || (tag === 'input' && /submit|button/i.test(el.type || ''));
    if (looksButton && out.buttons.length < 40) {
      out.buttons.push({
        label, text,
        bg: norm(s.backgroundColor), color: norm(s.color),
        border: `${s.borderWidth} ${s.borderStyle} ${norm(s.borderColor)}`,
        borderRadius: s.borderRadius, padding: s.padding,
        fontSize: s.fontSize, fontWeight: s.fontWeight,
        textTransform: s.textTransform,
      });
    }
  }
  return out;
}

function mergeInto(target, src) {
  for (const cat of Object.keys(src)) {
    if (cat === 'buttons') { target.buttons = (target.buttons || []).concat(src.buttons); continue; }
    if (cat === 'headings') {
      target.headings = target.headings || {};
      for (const h of Object.keys(src.headings)) {
        target.headings[h] = target.headings[h] || {};
        for (const [k, v] of Object.entries(src.headings[h])) {
          if (!target.headings[h][k]) target.headings[h][k] = { count: 0, samples: [] };
          target.headings[h][k].count += v.count;
          v.samples.forEach((sm) => { if (target.headings[h][k].samples.length < 4 && !target.headings[h][k].samples.includes(sm)) target.headings[h][k].samples.push(sm); });
        }
      }
      continue;
    }
    target[cat] = target[cat] || {};
    for (const [k, v] of Object.entries(src[cat])) {
      if (!target[cat][k]) target[cat][k] = { count: 0, samples: [] };
      target[cat][k].count += v.count;
      v.samples.forEach((sm) => { if (target[cat][k].samples.length < 4 && !target[cat][k].samples.includes(sm)) target[cat][k].samples.push(sm); });
    }
  }
}

const agg = { mobile: {}, desktop: {} };
const pageStatus = [];
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: vp, userAgent: 'Mozilla/5.0 (token-extractor)' });
    for (const p of PATHS) {
      const page = await ctx.newPage();
      const url = `${BASE}${p}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try {
          const cookie = page.locator('button:has-text("Accept all cookies")').first();
          if (await cookie.count()) { await cookie.click({ timeout: 2500 }); await page.waitForTimeout(200); }
        } catch { /* no banner */ }
        await page.waitForTimeout(700);
        const data = await page.evaluate(harvest);
        mergeInto(agg[vpName], data);
        if (vpName === 'desktop') pageStatus.push({ path: p, ok: true });
      } catch (e) {
        if (vpName === 'desktop') pageStatus.push({ path: p, ok: false, err: e.message.split('\n')[0] });
      } finally {
        await page.close();
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

const rank = (map, n = 12) => Object.entries(map || {})
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, n)
  .map(([value, { count, samples }]) => ({ value, count, samples }));

const report = { capturedFrom: `${BASE}/cit/`, pages: pageStatus, mobile: {}, desktop: {} };
for (const vp of ['mobile', 'desktop']) {
  const a = agg[vp];
  report[vp] = {
    colorText: rank(a.colorText),
    colorBg: rank(a.colorBg),
    colorBorder: rank(a.colorBorder),
    linkColor: rank(a.linkColor),
    fontFamily: rank(a.fontFamily, 8),
    fontSize: rank(a.fontSize, 16),
    fontWeight: rank(a.fontWeight),
    lineHeight: rank(a.lineHeight, 14),
    letterSpacing: rank(a.letterSpacing),
    borderRadius: rank(a.borderRadius),
    headings: Object.fromEntries(Object.entries(a.headings || {}).map(([h, m]) => [h, rank(m, 4)])),
  };
}
const btnSig = (b) => `${b.bg}|${b.color}|${b.borderRadius}|${b.padding}|${b.textTransform}`;
const seen = new Set();
report.buttons = [];
for (const b of (agg.desktop.buttons || []).concat(agg.mobile.buttons || [])) {
  const sig = btnSig(b);
  if (seen.has(sig)) continue;
  seen.add(sig);
  report.buttons.push(b);
}

const outDir = join(process.cwd(), 'tools/quality/visual-output');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'cit-tokens-raw.json'), JSON.stringify(report, null, 2));
const okCount = pageStatus.filter((p) => p.ok).length;
console.log(`Extracted from ${okCount}/${pageStatus.length} pages x 2 viewports.`);
console.log(`Failed: ${pageStatus.filter((p) => !p.ok).map((p) => p.path).join(', ') || 'none'}`);
console.log('Raw report: tools/quality/visual-output/cit-tokens-raw.json');
