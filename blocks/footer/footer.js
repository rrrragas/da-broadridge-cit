import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment. Prefer the git-committed content fragment
  // (/content/footer.plain.html — served locally by `aem up` and in production
  // from git, and the migration source of truth), falling back to the DA-authored
  // footer path when the content fragment isn't present.
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  let fragment = await loadFragment('/content/footer');
  if (!fragment) fragment = await loadFragment(footerPath);

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

  // Tag the brand-intro band (logo + company description) — the wrapper that has
  // an image but no heading/list — so footer.css can style it.
  footer.querySelectorAll('.default-content-wrapper').forEach((wrapper) => {
    const hasImg = wrapper.querySelector('img');
    const hasHeading = wrapper.querySelector('h1, h2, h3, h4, h5, h6');
    const hasList = wrapper.querySelector('ul, ol');
    if (hasImg && !hasHeading && !hasList) wrapper.classList.add('footer-brand-intro');
  });

  // Tag social links (external social profiles) and render them as icons —
  // matching the source, which shows brand glyphs, not the network name in text.
  // Content-first: the fragment keeps the plain-text label (portable + accessible);
  // the icon is injected here and the text is visually hidden.
  const SOCIAL_HOSTS = {
    'facebook.com': 'facebook',
    'twitter.com': 'twitter',
    'x.com': 'twitter',
    'linkedin.com': 'linkedin',
    'youtube.com': 'youtube',
    'instagram.com': 'instagram',
  };
  footer.querySelectorAll('a[href]').forEach((a) => {
    let host;
    try {
      host = new URL(a.href, window.location).hostname.replace(/^www\./, '');
    } catch {
      return;
    }
    const network = SOCIAL_HOSTS[host] || Object.entries(SOCIAL_HOSTS)
      .find(([h]) => host === h || host.endsWith(`.${h}`))?.[1];
    if (!network) return;
    a.classList.add('footer-social-link');
    const label = a.textContent.trim();
    a.setAttribute('aria-label', label || network);
    // build the icon (aem.js decorateIcons turns span.icon.icon-* into an <img>)
    const iconSpan = document.createElement('span');
    iconSpan.className = `icon icon-${network}`;
    const img = document.createElement('img');
    img.src = `${window.hlx.codeBasePath}/icons/${network}.svg`;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 20;
    img.height = 20;
    iconSpan.append(img);
    // keep the text label for screen readers, visually hidden
    const sr = document.createElement('span');
    sr.className = 'footer-social-label';
    sr.textContent = label;
    a.textContent = '';
    a.append(iconSpan, sr);
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

  // Compose the top row: brand-intro (description) on the left, link columns on
  // the right — matching the source's side-by-side desktop layout. The two
  // sections round-trip as separate section wrappers; wrap them together so
  // footer.css can place them on one row (they stack again below the breakpoint).
  const brandIntro = footer.querySelector('.footer-brand-intro')?.closest('.section') || footer.querySelector('.footer-brand-intro');
  const footerNav = footer.querySelector('.footer-nav')?.closest('.section') || footer.querySelector('.footer-nav');
  if (brandIntro && footerNav && brandIntro.parentElement === footerNav.parentElement) {
    const topRow = document.createElement('div');
    topRow.className = 'footer-top';
    brandIntro.parentElement.insertBefore(topRow, brandIntro);
    topRow.append(brandIntro, footerNav);
  }

  // Tag the bottom row (social + copyright + legal — the wrapper that isn't the
  // brand-intro or the nav) so footer.css can render the source's darker sub-bar.
  footer.querySelectorAll('.default-content-wrapper').forEach((wrapper) => {
    if (wrapper.classList.contains('footer-brand-intro') || wrapper.classList.contains('footer-nav')) return;
    if (wrapper.querySelector('a.footer-social-link') || /All Rights Reserved/i.test(wrapper.textContent)) {
      wrapper.classList.add('footer-bottom');
    }
  });

  block.append(footer);
}
