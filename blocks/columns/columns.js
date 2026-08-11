/**
 * columns: side-by-side content layout.
 *
 * Base: N equal columns; a column whose only content is an image is tagged
 * `columns-img-col` (text | image layouts).
 *
 * Variant `compare`: two comparison lists (e.g. "X are:" vs "X are not:").
 * The first column is tagged `columns-positive`, the last `columns-negative`,
 * and CSS renders check / cross icon bullets via `::before`.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);
  const isCompare = block.classList.contains('compare');

  [...block.children].forEach((row) => {
    const columns = [...row.children];
    columns.forEach((col, i) => {
      // image-only column detection (text | image layouts)
      const pic = col.querySelector('picture');
      if (pic && pic.closest('div') === col && col.children.length === 1) {
        col.classList.add('columns-img-col');
      }

      // comparison variant: tag first/last column for icon bullets
      if (isCompare) {
        if (i === 0) col.classList.add('columns-positive');
        else if (i === columns.length - 1) col.classList.add('columns-negative');
      }
    });
  });
}
