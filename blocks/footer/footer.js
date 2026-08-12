import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  // Neutralize legal placeholder links. The source's legal links had no real
  // destinations (javascript:void(0)); the migrated content stores href="#",
  // which the delivery pipeline rewrites to "/". A "/" would misleadingly jump
  // to the homepage, so convert these known-placeholder legal links into
  // non-navigating placeholders (kept as links visually, but inert + flagged
  // for assistive tech) until real destinations are supplied.
  const LEGAL_LABELS = new Set([
    'terms of use & linking policy',
    'accessibility statement',
    'legal statements',
    'privacy statement',
    'do not sell my personal information',
    'your privacy choices',
  ]);
  footer.querySelectorAll('a').forEach((a) => {
    const label = a.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    const href = a.getAttribute('href') || '';
    // only the known legal labels whose href is a placeholder (#, /, or empty)
    if (LEGAL_LABELS.has(label) && (href === '#' || href === '/' || href === '')) {
      a.removeAttribute('href');
      a.setAttribute('role', 'link');
      a.setAttribute('aria-disabled', 'true');
      a.classList.add('footer-legal-placeholder');
    }
  });

  // Group each heading + its following list into a link-group so the groups
  // can sit side by side. The content round-trips as flat siblings
  // (h3, ul, h3, ul) inside one default-content-wrapper, so we re-wrap here.
  footer.querySelectorAll('.default-content-wrapper').forEach((wrapper) => {
    const hasGroups = wrapper.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6')
      && wrapper.querySelector(':scope > ul, :scope > ol');
    if (!hasGroups) return;
    wrapper.classList.add('footer-nav');
    let group = null;
    [...wrapper.children].forEach((el) => {
      if (/^H[1-6]$/.test(el.tagName)) {
        group = document.createElement('div');
        group.className = 'footer-link-group';
        wrapper.insertBefore(group, el);
        group.append(el);
      } else if (group) {
        group.append(el);
      }
    });
  });

  block.append(footer);
}
