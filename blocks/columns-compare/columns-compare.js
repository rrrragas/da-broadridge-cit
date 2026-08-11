/**
 * columns-compare: side-by-side comparison lists variant
 * (e.g. "X are:" vs "X are not:" with positive/negative icon bullets).
 * The first column is styled as the positive list, the second as the negative list.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-compare-${cols.length}-cols`);

  // tag first/last columns so CSS can render positive vs negative bullet icons
  [...block.children].forEach((row) => {
    const columns = [...row.children];
    columns.forEach((col, i) => {
      if (i === 0) col.classList.add('columns-compare-positive');
      else if (i === columns.length - 1) col.classList.add('columns-compare-negative');

      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-compare-img-col');
        }
      }
    });
  });
}
