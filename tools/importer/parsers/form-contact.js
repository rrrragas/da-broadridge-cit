/* eslint-disable */
/* global WebImporter */
/**
 * Parser for `form-contact`.
 * Base block: form (client-side "Talk to Us" lead-capture form).
 * Source: https://www.broadridge.com/cit/
 * Generated: 2026-08-11
 *
 * IMPORTANT: The form-contact block builds ALL form fields (name, country,
 * comments, submit, success, support/FAQ) client-side from a small key/value
 * config table. The raw source markup (`#talk-to-us`) is a huge Divi/legacy
 * widget with a full country <select>, reCAPTCHA text, hidden inputs, base64
 * SVGs, etc. — none of which is authorable content. We therefore DO NOT dump
 * the source form. Instead we emit the author-editable 2-column key/value table
 * the block's readConfig() consumes.
 *
 * readConfig() model (each row = [key, value]; keys are lowercased):
 *   Heading  -> config.heading  (form title, rendered as <h2>)
 *   Intro    -> config.intro    (optional rich-text under the heading)
 *   Submit   -> config.submit   (submit button label)
 *   Support  -> config.support  (support line text)
 *   FAQ      -> config.faq       (a link: href + label)
 *   Success  -> config.success  (thank-you heading shown after submit)
 *
 * Values are sourced from the live widget where present:
 *   Heading  "Talk to us"                       (h3.talk-to-us__form__title)
 *   Submit   "Contact Sales"                    (#talk-to-us__submit)
 *   Support  "Matrix Trust client support: +1 888 947 3472"
 *   FAQ      link -> matrix-trust-company-faq   (#mksmall anchor)
 *   Success  "Thank You"                        (#thank-you-placeholder heading)
 * Intro is omitted (source default is a generic "a representative will contact
 * you" line; left for the author to fill in).
 */
export default function parse(element, { document }) {
  // Pull real values from the source widget when available, with stable fallbacks.
  const pick = (sel) => {
    const el = element.querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  };

  const heading = pick('.talk-to-us__form__title, h3[class*="form__title"]') || 'Talk to us';
  const submit = pick('#talk-to-us__submit, button.cta') || 'Contact Sales';

  // Support line: "<label>: <phone>" — combine the label and the phone number.
  const supportLabel = pick('.top_contact_info > p, .talk-to-us__contact-info p')
    || 'Matrix Trust client support:';
  let phone = '';
  const cit = element.querySelector('.talk-to-us__cit-contact');
  if (cit) {
    // Phone text is the h4's own text before the <br>/nested link.
    const h4 = cit.querySelector('h4');
    if (h4) {
      const raw = (h4.childNodes[0] && h4.childNodes[0].textContent) || h4.textContent;
      phone = raw.replace(/\s+/g, ' ').trim();
    }
  }
  if (!phone) phone = '+1 888 947 3472';
  const support = `${supportLabel.replace(/:\s*$/, '')}: ${phone}`;

  // FAQ link.
  const faqAnchor = element.querySelector('a[href*="faq"]')
    || element.querySelector('.talk-to-us__cit-contact a[href]');
  const faqHref = faqAnchor ? faqAnchor.getAttribute('href')
    : 'https://www.broadridge.com/client-access/matrix-trust-company-faq';
  const faqLabel = (faqAnchor ? faqAnchor.textContent.replace(/\s+/g, ' ').trim() : '')
    || 'Frequently asked questions';

  const success = pick('#thank-you-placeholder-138334 .talk-to-us__form__title, [id^="thank-you-placeholder"] .talk-to-us__form__title')
    || 'Thank You';

  // Build the FAQ value as a real anchor element so the block reads href + label.
  const faqLink = document.createElement('a');
  faqLink.href = faqHref;
  faqLink.textContent = faqLabel;

  // 2-column key/value rows (matches readConfig). Intro intentionally omitted.
  const cells = [
    ['Heading', heading],
    ['Submit', submit],
    ['Support', support],
    ['FAQ', faqLink],
    ['Success', success],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'form-contact', cells });
  element.replaceWith(block);
}
