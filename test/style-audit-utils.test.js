import { describe, it, expect } from 'vitest';
import {
  isColoredBand, horizontalSide, auditSectionTransitions, layoutRelation, renderMode,
  normalizeText, roleOf, fingerprint, matchNodes, diffMatchedNode,
} from '../tools/quality/lib/style-audit-utils.mjs';

describe('isColoredBand', () => {
  it('treats solid non-white colors as bands', () => {
    expect(isColoredBand('rgb(0, 31, 90)')).toBe(true); // navy
    expect(isColoredBand('rgb(240, 242, 246)')).toBe(true); // cool grey surface
  });

  it('treats white / near-white as the page background (not a band)', () => {
    expect(isColoredBand('rgb(255, 255, 255)')).toBe(false);
    expect(isColoredBand('rgb(251, 252, 253)')).toBe(false);
  });

  it('treats fully transparent as not a band', () => {
    expect(isColoredBand('rgba(0, 0, 0, 0)')).toBe(false);
    expect(isColoredBand('transparent')).toBe(false);
  });

  it('handles unparseable input', () => {
    expect(isColoredBand(null)).toBe(false);
    expect(isColoredBand('')).toBe(false);
  });
});

describe('horizontalSide', () => {
  it('classifies left vs right of the container centre', () => {
    expect(horizontalSide(24, 187)).toBe('left'); // hamburger near left edge
    expect(horizontalSide(331, 187)).toBe('right'); // hamburger near right edge
  });

  it('returns null when a coordinate is missing', () => {
    expect(horizontalSide(null, 187)).toBe(null);
    expect(horizontalSide(24, null)).toBe(null);
  });
});

describe('auditSectionTransitions', () => {
  const band = 'rgb(0, 31, 90)';
  const white = 'rgb(255, 255, 255)';

  it('flags a white gap between a colored band and the next section', () => {
    const issues = auditSectionTransitions([
      { top: 0, bottom: 100, height: 100, bg: 'rgba(0,0,0,0)' },
      { top: 140, bottom: 400, height: 260, bg: band }, // 40px gap before a navy band
    ]);
    const gap = issues.find((i) => i.kind === 'gap');
    expect(gap).toBeTruthy();
    expect(gap.gap).toBe(40);
    expect(gap.severity).toBe('🔴'); // >=24px
  });

  it('does not flag flush sections', () => {
    const issues = auditSectionTransitions([
      { top: 0, bottom: 100, height: 100, bg: band },
      { top: 100, bottom: 300, height: 200, bg: band },
    ]);
    expect(issues.filter((i) => i.kind === 'gap')).toHaveLength(0);
  });

  it('ignores gaps between two plain white sections', () => {
    const issues = auditSectionTransitions([
      { top: 0, bottom: 100, height: 100, bg: white },
      { top: 140, bottom: 300, height: 160, bg: white },
    ]);
    expect(issues.filter((i) => i.kind === 'gap')).toHaveLength(0);
  });

  it('flags an empty section that still occupies space via its margins', () => {
    const issues = auditSectionTransitions([
      { top: 0, bottom: 100, height: 100, bg: band },
      {
        top: 100, bottom: 100, height: 0, bg: 'rgba(0,0,0,0)', marginTop: 40, marginBottom: 40, empty: true,
      },
    ]);
    const empty = issues.find((i) => i.kind === 'empty-section');
    expect(empty).toBeTruthy();
    expect(empty.space).toBe(80);
  });

  it('does not flag a zero-space empty section', () => {
    const issues = auditSectionTransitions([
      {
        top: 0, bottom: 0, height: 0, bg: 'rgba(0,0,0,0)', marginTop: 0, marginBottom: 0, empty: true,
      },
    ]);
    expect(issues.filter((i) => i.kind === 'empty-section')).toHaveLength(0);
  });

  it('respects gapTolerance for sub-pixel rounding', () => {
    const issues = auditSectionTransitions([
      { top: 0, bottom: 100, height: 100, bg: band },
      { top: 101, bottom: 300, height: 199, bg: band },
    ], { gapTolerance: 1 });
    expect(issues).toHaveLength(0);
  });
});

describe('layoutRelation', () => {
  it('detects link columns BESIDE the description (source layout)', () => {
    const desc = { x: 120, y: 330, w: 354, h: 120 };
    const links = { x: 764, y: 393, w: 556, h: 90 }; // same row, to the right
    expect(layoutRelation(desc, links)).toBe('beside-right');
  });

  it('detects link columns BELOW the description (the regression)', () => {
    const desc = { x: 120, y: 507, w: 720, h: 90 };
    const links = { x: 120, y: 603, w: 300, h: 120 }; // next row down
    expect(layoutRelation(desc, links)).toBe('below');
  });

  it('flags the beside→below regression as a mismatch', () => {
    const src = layoutRelation({ x: 120, y: 330, w: 354, h: 120 }, { x: 764, y: 393, w: 556, h: 90 });
    const mig = layoutRelation({ x: 120, y: 507, w: 720, h: 90 }, { x: 120, y: 603, w: 300, h: 120 });
    expect(src).not.toBe(mig);
  });

  it('returns null when a region is missing', () => {
    expect(layoutRelation(null, { x: 0, y: 0, w: 10, h: 10 })).toBe(null);
  });
});

describe('renderMode', () => {
  it('classifies SVG/img social icons as icon (source)', () => {
    expect(renderMode({ tag: 'svg', hasSvg: true, text: '' })).toBe('icon');
    expect(renderMode({ tag: 'a', hasImg: true, text: '' })).toBe('icon');
  });

  it('classifies an icon-font ::before glyph as icon', () => {
    expect(renderMode({ tag: 'a', beforeContent: '"\\f09a"', text: '' })).toBe('icon');
  });

  it('classifies plain-text social links as text (the regression)', () => {
    expect(renderMode({ tag: 'a', hasImg: false, hasSvg: false, beforeContent: 'none', text: 'Facebook' })).toBe('text');
  });

  it('flags the icon→text regression as a mismatch', () => {
    expect(renderMode({ tag: 'svg', hasSvg: true, text: '' }))
      .not.toBe(renderMode({ tag: 'a', beforeContent: 'none', text: 'Facebook' }));
  });
});

describe('normalizeText', () => {
  it('collapses whitespace, trims, lowercases', () => {
    expect(normalizeText('  CIT   Services\n')).toBe('cit services');
  });

  it('strips zero-width characters', () => {
    expect(normalizeText('Home​')).toBe('home');
  });

  it('handles null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('roleOf', () => {
  it('maps heading tags to level-specific roles', () => {
    expect(roleOf('h1')).toBe('heading1');
    expect(roleOf('H3')).toBe('heading3');
  });

  it('maps links, list items, paragraphs', () => {
    expect(roleOf('a')).toBe('link');
    expect(roleOf('li')).toBe('listitem');
    expect(roleOf('p')).toBe('text');
  });

  it('honors image/button hints', () => {
    expect(roleOf('span', { isImage: true })).toBe('image');
    expect(roleOf('a', { isButton: true })).toBe('button');
    expect(roleOf('img')).toBe('image');
  });
});

describe('fingerprint', () => {
  it('is identical for same role+text across implementations', () => {
    expect(fingerprint({ role: 'link', text: 'CIT Services\n' }))
      .toBe(fingerprint({ role: 'link', text: 'cit services' }));
  });

  it('differs when role differs', () => {
    expect(fingerprint({ role: 'heading3', text: 'Matrix Trust' }))
      .not.toBe(fingerprint({ role: 'text', text: 'Matrix Trust' }));
  });

  it('keys images on src basename, ignoring path/query', () => {
    expect(fingerprint({ role: 'image', src: 'https://x/logo.png?v=2' }))
      .toBe(fingerprint({ role: 'image', src: '/images/logo.png' }));
  });
});

describe('matchNodes (content-anchored)', () => {
  const link = (t) => ({ role: 'link', text: t });

  it('pairs identical content regardless of order-preserving markup', () => {
    const src = [link('Home'), link('CIT Services'), link('About Us')];
    const mig = [link('Home'), link('CIT Services'), link('About Us')];
    const { pairs, missing, added } = matchNodes(src, mig);
    expect(pairs).toHaveLength(3);
    expect(missing).toHaveLength(0);
    expect(added).toHaveLength(0);
  });

  it('reports a dropped source node as MISSING (the footer description case)', () => {
    const src = [{ role: 'text', text: 'Broadridge is a global technology leader' }, link('Home')];
    const mig = [link('Home')];
    const { missing } = matchNodes(src, mig);
    expect(missing).toHaveLength(1);
    expect(missing[0].text).toMatch(/global technology leader/);
  });

  it('reports a migrated-only node as ADDED', () => {
    const src = [link('Home')];
    const mig = [link('Home'), link('Extra')];
    const { added } = matchNodes(src, mig);
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe('Extra');
  });

  it('does NOT cascade after a single insertion (LCS, not index-based)', () => {
    // migrated inserts one node up front; the other three must still pair.
    const src = [link('A'), link('B'), link('C')];
    const mig = [link('X'), link('A'), link('B'), link('C')];
    const { pairs, added } = matchNodes(src, mig);
    expect(pairs).toHaveLength(3); // A,B,C still matched
    expect(added.map((n) => n.text)).toEqual(['X']);
  });

  it('excludes the dynamic ticker link cleanly (source-only → missing)', () => {
    const src = [link('BR (NYSE) 169.27'), link('Facebook')];
    const mig = [link('Facebook')];
    const { pairs, missing } = matchNodes(src, mig);
    expect(pairs).toHaveLength(1);
    expect(missing[0].text).toMatch(/NYSE/);
  });
});

describe('diffMatchedNode', () => {
  it('flags real style drift and drops negligible deltas', () => {
    const pair = {
      source: { styles: { color: 'rgb(105, 135, 145)', 'font-size': '12px' } },
      migrated: { styles: { color: 'rgb(255, 255, 255)', 'font-size': '12px' } },
    };
    const rows = diffMatchedNode(pair, ['color', 'font-size']);
    expect(rows).toHaveLength(1); // color differs; font-size identical
    expect(rows[0].prop).toBe('color');
  });

  it('returns no rows when styles match', () => {
    const pair = {
      source: { styles: { color: 'rgb(0,0,0)' } },
      migrated: { styles: { color: 'rgb(0,0,0)' } },
    };
    expect(diffMatchedNode(pair, ['color'])).toHaveLength(0);
  });
});
