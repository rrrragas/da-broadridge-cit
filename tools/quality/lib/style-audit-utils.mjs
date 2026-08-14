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

// True when a background is a solid, non-transparent, non-white "band" (a colored
// section), as opposed to the transparent/white page background. Used to decide
// whether a gap next to a section is a likely unintended white seam.
export function isColoredBand(bg) {
  const rgb = parseRgb(bg);
  if (!rgb) return false;
  const alpha = String(bg).match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
  if (alpha && parseFloat(alpha[1]) === 0) return false; // fully transparent
  const [r, g, b] = rgb;
  if (r >= 250 && g >= 250 && b >= 250) return false; // ~white = page background
  return true;
}

// Which half of its container an element's centre sits in — for catching mirrored
// layouts (e.g. a mobile hamburger that renders left when the source has it right).
// Returns 'left' | 'right' | null.
export function horizontalSide(elCenterX, containerCenterX) {
  if (elCenterX == null || containerCenterX == null) return null;
  return elCenterX < containerCenterX ? 'left' : 'right';
}

// Composition relation between two regions A and B (each a box {x,y,w,h} or
// {x,y,right,bottom}). Property-level diffs can't see this: two footers with
// identical fonts/colors can still lay out "links BESIDE description" vs "links
// BELOW description". Returns a compact signature string, e.g. "beside-right"
// (B sits to the right of A on the same row) or "below" (B stacks under A).
// Overlap on the cross-axis decides row vs column; the sign decides the side.
export function layoutRelation(a, b) {
  if (!a || !b) return null;
  const ay2 = a.bottom != null ? a.bottom : a.y + (a.h || 0);
  const by2 = b.bottom != null ? b.bottom : b.y + (b.h || 0);
  const ax2 = a.right != null ? a.right : a.x + (a.w || 0);
  const bx2 = b.right != null ? b.right : b.x + (b.w || 0);
  // vertical overlap ratio → are they on the same row?
  const vOverlap = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const minH = Math.max(1, Math.min(ay2 - a.y, by2 - b.y));
  const sameRow = vOverlap / minH > 0.35;
  if (sameRow) return b.x >= ax2 - 4 ? 'beside-right' : (bx2 <= a.x + 4 ? 'beside-left' : 'overlapping-row');
  return b.y >= ay2 - 4 ? 'below' : (by2 <= a.y + 4 ? 'above' : 'overlapping-col');
}

// Classify how a link/element is rendered: as an image/icon vs. plain text.
// Catches the footer social case (source = SVG/icons, migration = text words),
// which is invisible to color/size diffs. `el` describes the DOM node:
// { tag, hasImg, hasSvg, beforeContent, text }. Returns 'icon' | 'text' | 'empty'.
export function renderMode({
  tag, hasImg, hasSvg, beforeContent, text,
} = {}) {
  if (hasImg || hasSvg || (tag && /^(img|svg|picture|i)$/i.test(tag))) return 'icon';
  // a CSS ::before glyph with content is an icon-font rendering
  if (beforeContent && beforeContent !== 'none' && beforeContent !== 'normal' && beforeContent !== '""' && beforeContent !== "''") return 'icon';
  if (text && text.trim().length) return 'text';
  return 'empty';
}

// Structural audit of a page's ordered sections. Flags two layout smells that the
// property-level block audit can't see:
//  1. a positive gap between adjacent sections where either is a colored band —
//     in this flush design that reads as an unintended white stripe;
//  2. an empty section that still occupies vertical space (e.g. the wrapper left
//     behind after the page `metadata` block is extracted into <head>).
// `sections`: ordered [{ top, bottom, height, bg, marginTop, marginBottom, empty }].
// Returns [{ kind, severity, detail, ... }] — advisory, project-tuned heuristic.
export function auditSectionTransitions(sections, { gapTolerance = 1 } = {}) {
  const issues = [];
  for (let i = 1; i < sections.length; i += 1) {
    const prev = sections[i - 1];
    const cur = sections[i];
    const gap = Math.round(cur.top - prev.bottom);
    if (gap > gapTolerance && (isColoredBand(prev.bg) || isColoredBand(cur.bg))) {
      issues.push({
        kind: 'gap',
        between: `${i - 1}->${i}`,
        gap,
        severity: gap >= 24 ? '🔴' : '🟡',
        detail: `${gap}px gap adjacent to a colored section — likely an unintended white band`,
      });
    }
  }
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    const space = Math.round(Math.max(s.height || 0, (s.marginTop || 0) + (s.marginBottom || 0)));
    if (s.empty && space > gapTolerance) {
      issues.push({
        kind: 'empty-section',
        at: i,
        space,
        severity: '🟡',
        detail: `empty section still occupies ${space}px — e.g. a leftover metadata-block wrapper`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Content-anchored comparison — the generic engine's core (browser-free, so it
// unit-tests). The browser runner produces a flat, ordered list of "node
// descriptors" for each side; these helpers match source→migrated nodes by
// CONTENT (role + normalized text) rather than by selector, because the two
// DOMs are unrelated (legacy markup vs clean EDS) but the text is the same.
// Matched pairs get their styles/geometry diffed; unmatched source nodes are
// MISSING content, unmatched migrated nodes are additions.
// ---------------------------------------------------------------------------

// Collapse whitespace, drop zero-width/pipe noise, lowercase — so "CIT  Services\n"
// and "cit services" fingerprint the same across the two implementations.
export function normalizeText(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .toLowerCase();
}

// Coarse semantic role from a tag name (+ optional hints). Roles are the match
// axis alongside text: a heading only matches a heading, a link only a link.
export function roleOf(tag, { isButton = false, isImage = false } = {}) {
  const t = String(tag || '').toLowerCase();
  if (isImage || t === 'img' || t === 'picture' || t === 'svg') return 'image';
  if (isButton) return 'button';
  if (/^h[1-6]$/.test(t)) return `heading${t.slice(1)}`;
  if (t === 'a') return 'link';
  if (t === 'li') return 'listitem';
  if (t === 'p') return 'text';
  if (t === 'button') return 'button';
  return 'text';
}

// A stable content fingerprint for one node descriptor { role, text, src }.
// Images have no text, so they key on role + basename of their src.
export function fingerprint(node) {
  if (!node) return '∅';
  if (node.role === 'image') {
    const base = String(node.src || '').split('/').pop()?.split('?')[0] || '';
    return `image|${base}`;
  }
  return `${node.role}|${normalizeText(node.text)}`;
}

// Align two ordered node lists by content fingerprint using an LCS (longest
// common subsequence) so order is preserved and single insertions/deletions
// don't cascade into a wall of false mismatches (the failure mode of index-
// based matching). Returns { pairs:[{source,migrated,index}], missing:[...],
// added:[...] } — missing = in source, absent in migrated (likely dropped
// content); added = migrated-only.
export function matchNodes(sourceNodes = [], migratedNodes = []) {
  const a = sourceNodes;
  const b = migratedNodes;
  const n = a.length;
  const m = b.length;
  // LCS table over fingerprints
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = fingerprint(a[i]) === fingerprint(b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  const missing = [];
  const added = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (fingerprint(a[i]) === fingerprint(b[j])) {
      pairs.push({ source: a[i], migrated: b[j], index: pairs.length });
      i += 1; j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      missing.push(a[i]); i += 1;
    } else {
      added.push(b[j]); j += 1;
    }
  }
  while (i < n) { missing.push(a[i]); i += 1; }
  while (j < m) { added.push(b[j]); j += 1; }
  return { pairs, missing, added };
}

// Diff one matched pair's style props via classify(); returns the flagged rows
// (🟢 negligible are dropped so the report shows only real drift). `props` is
// the list of dot-path keys to compare on each node's `styles` map.
export function diffMatchedNode(pair, props) {
  const rows = [];
  for (const key of props) {
    const sv = pair.source?.styles?.[key];
    const mv = pair.migrated?.styles?.[key];
    if (sv == null && mv == null) continue;
    const sourceValue = String(sv);
    const migratedValue = String(mv);
    if ((key === 'font-family' ? sourceValue.toLowerCase() === migratedValue.toLowerCase() : sourceValue === migratedValue)) continue;
    const cls = classify(key, sv, mv);
    if (cls.icon === '🟢') continue;
    rows.push({
      prop: key, source: String(sv), migrated: String(mv), ...cls,
    });
  }
  return rows;
}
