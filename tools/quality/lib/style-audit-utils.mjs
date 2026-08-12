/**
 * Shared helpers for the visual/style audit scripts (broadridge-visual-diff.mjs,
 * broadridge-block-audit.mjs): numeric parsing, color-distance severity classification, and
 * WCAG contrast ratio. Kept dependency-free (no browser APIs) so it can be unit-imported.
 */

export const numOf = (v) => { const m = String(v).match(/-?[\d.]+/); return m ? parseFloat(m[0]) : null; };

export const parseRgb = (v) => {
  const m = String(v).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export const colorDistance = (a, b) => {
  const pa = parseRgb(a); const pb = parseRgb(b);
  return (pa && pb) ? Math.sqrt(pa.reduce((sum, v, i) => sum + (v - pb[i]) ** 2, 0)) : null;
};

// Severity classification for a real (non-allowlisted) drift: how much should this worry a
// reviewer? Color mismatches are judged by RGB distance (a navy->white swap is a brand issue; a
// shade shift isn't); everything else by absolute/percent delta. This is a heuristic, not a
// design-intent oracle — allowlist genuine intentional deviations rather than fighting the label.
export function classify(prop, expected, actual) {
  if (/color|background/i.test(prop)) {
    const dist = colorDistance(expected, actual);
    if (dist == null) return { icon: '🟡', label: 'differs' };
    if (dist > 150) return { icon: '🔴', label: 'clear divergence' };
    if (dist > 40) return { icon: '🟡', label: 'noticeable' };
    return { icon: '🟢', label: 'negligible' };
  }
  const e = numOf(expected); const a = numOf(actual);
  if (e != null && a != null) {
    const absDelta = Math.abs(e - a);
    const pctDelta = e !== 0 ? absDelta / Math.abs(e) : (a === 0 ? 0 : 1);
    if (absDelta <= 2) return { icon: '🟢', label: 'negligible' };
    if (pctDelta >= 0.5) return { icon: '🔴', label: 'clear divergence' };
    return { icon: '🟡', label: 'minor' };
  }
  return { icon: '🟡', label: 'differs' };
}

// WCAG 2.1 relative luminance + contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Returns null if either color isn't a parseable rgb()/rgba() — e.g. a photo background, where
// contrast can't be computed from a single flat color and shouldn't be silently guessed at.
export function contrastRatio(colorA, colorB) {
  const a = parseRgb(colorA); const b = parseRgb(colorB);
  if (!a || !b) return null;
  const [lA, lB] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lA + 0.05) / (lB + 0.05);
}

// WCAG 2.1 AA: 3:1 for large text (>=24px, or >=19px/18.66px when bold), else 4.5:1.
export function wcagAAThreshold(fontSizePx, fontWeight) {
  const size = numOf(fontSizePx) || 16;
  const bold = numOf(fontWeight) >= 700;
  const large = size >= 24 || (bold && size >= 18.66);
  return large ? 3 : 4.5;
}
