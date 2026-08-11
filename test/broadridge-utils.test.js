import { describe, it, expect } from 'vitest';
import { isSafeUrl, formatCurrency, SAFE_PROTOCOLS } from '../scripts/broadridge-utils.js';

describe('isSafeUrl', () => {
  it('accepts allow-listed absolute protocols', () => {
    expect(isSafeUrl('https://example.com/page')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:a@b.com')).toBe(true);
    expect(isSafeUrl('tel:+15551234567')).toBe(true);
    expect(isSafeUrl('HTTPS://EXAMPLE.COM')).toBe(true); // scheme is case-insensitive
  });

  it('accepts relative, anchor, and query links', () => {
    expect(isSafeUrl('/en/products')).toBe(true);
    expect(isSafeUrl('./local')).toBe(true);
    expect(isSafeUrl('../up')).toBe(true);
    expect(isSafeUrl('#section')).toBe(true);
    expect(isSafeUrl('?q=1')).toBe(true);
    expect(isSafeUrl('page.html')).toBe(true);
  });

  it('rejects dangerous protocols', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('  javascript:alert(1)  ')).toBe(false); // whitespace-padded
    expect(isSafeUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(42)).toBe(false);
  });

  it('exposes the allow-list', () => {
    expect(SAFE_PROTOCOLS).toContain('https:');
    expect(SAFE_PROTOCOLS).not.toContain('data:');
  });
});

describe('formatCurrency', () => {
  it('formats with defaults (en-US, USD)', () => {
    expect(formatCurrency(1999.5)).toBe('$1,999.50');
  });

  it('respects locale and currency', () => {
    // Non-breaking spaces vary by ICU build, so assert on the meaningful parts.
    const eur = formatCurrency(1999.5, { locale: 'de-DE', currency: 'EUR' });
    expect(eur).toMatch(/1\.999,50/);
    expect(eur).toContain('€');
  });
});
