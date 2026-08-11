/**
 * hero-banner: full-width banner variant.
 * Row 2 = background image, row 3 = heading + subhead.
 * Adds `no-image` when no background picture is authored.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  if (!block.querySelector(':scope > div:first-child picture')) {
    block.classList.add('no-image');
  }
}
