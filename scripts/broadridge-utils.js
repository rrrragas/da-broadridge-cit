/*
 * Shared, dependency-free, DOM-light utilities for Broadridge CIT blocks.
 * Keep functions here pure and unit-tested (see test/utils.test.js). Anything that touches
 * the DOM or the network belongs in a block or in scripts.js, not here.
 */

/** URL protocols considered safe to render as links/sources (docs/broadridge-EDS-RULES.md §4). */
export const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * True when `href` is safe to use as a link/image source: a relative/anchor path, or an
 * absolute URL on an allow-listed protocol. Blocks `javascript:`, `data:`, `vbscript:`, etc.
 * @param {string} href
 * @returns {boolean}
 */
export function isSafeUrl(href) {
  if (typeof href !== 'string') return false;
  const value = href.trim();
  if (value === '') return false;
  // relative paths, query-only, and hash anchors are always safe
  if (/^(\/|\.\/|\.\.\/|#|\?)/.test(value)) return true;
  try {
    return SAFE_PROTOCOLS.includes(new URL(value, 'https://base.invalid').protocol);
  } catch {
    return false;
  }
}

/**
 * Locale-aware currency formatter — never hand-roll currency strings (broadridge-EDS-RULES.md §7).
 * @param {number} amount
 * @param {{ locale?: string, currency?: string }} [options]
 * @returns {string}
 */
export function formatCurrency(amount, { locale = 'en-US', currency = 'USD' } = {}) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
