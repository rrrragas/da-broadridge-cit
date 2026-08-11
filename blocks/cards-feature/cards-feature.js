import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * cards-feature: feature-tile card variant.
 * Each row becomes a card (li). Text-only tiles are supported (no image cell).
 * If a card body contains a single link, the whole tile is made clickable via a
 * stretched-link overlay.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-feature-card-image';
      else div.className = 'cards-feature-card-body';
    });

    // make the whole tile clickable if the body contains a link
    const body = li.querySelector('.cards-feature-card-body');
    const link = body && body.querySelector('a[href]');
    if (link) {
      link.classList.add('cards-feature-link');
      li.classList.add('cards-feature-clickable');
    }

    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}
