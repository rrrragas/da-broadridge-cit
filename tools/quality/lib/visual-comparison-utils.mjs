/** Shared browser capture sizes for migration-parity visual validation. */
export const VISUAL_VIEWPORTS = Object.freeze({
  mobile: { width: 300, height: 667, range: '<600px' },
  tablet: { width: 600, height: 900, range: '600-899px' },
  desktop: { width: 1200, height: 900, range: '>=900px' },
});

export function formatVisualViewportSummary(names = Object.keys(VISUAL_VIEWPORTS)) {
  return names.map((name) => {
    const viewport = VISUAL_VIEWPORTS[name];
    return `${name} ${viewport.range} (${viewport.width}px)`;
  }).join(', ');
}
