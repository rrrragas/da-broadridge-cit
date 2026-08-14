import { describe, expect, it } from 'vitest';
import {
  VISUAL_VIEWPORTS,
  formatVisualViewportSummary,
} from '../tools/quality/lib/visual-comparison-utils.mjs';

describe('migration visual viewport matrix', () => {
  it('uses the agreed project capture widths', () => {
    expect(VISUAL_VIEWPORTS.mobile).toMatchObject({ width: 300, range: '<600px' });
    expect(VISUAL_VIEWPORTS.tablet).toMatchObject({ width: 600, range: '600-899px' });
    expect(VISUAL_VIEWPORTS.desktop).toMatchObject({ width: 1200, range: '>=900px' });
  });

  it('labels report viewports with their CSS range and capture width', () => {
    expect(formatVisualViewportSummary(['mobile', 'desktop']))
      .toBe('mobile <600px (300px), desktop >=900px (1200px)');
  });
});
