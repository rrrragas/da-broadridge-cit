/**
 * form-contact: client-side lead-capture / "Talk to Us" form block.
 *
 * Authoring model (each row is a 2-cell key/value pair, all optional):
 *   | Heading       | Talk to us                                              |
 *   | Intro         | Tell us a bit about you and we'll be in touch.          |
 *   | Submit        | Contact Sales                                           |
 *   | Support       | Matrix Trust client support: +1 888 947 3472            |
 *   | FAQ           | [Frequently asked questions](https://.../faq)           |
 *   | Success       | Thank You                                               |
 *
 * Any single-cell row is treated as additional intro rich-text.
 * Submission is client-side only (no backend endpoint wired).
 *
 * @param {Element} block The block element
 */

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'France', 'Germany',
  'India', 'Ireland', 'Japan', 'Mexico', 'Netherlands', 'New Zealand',
  'Singapore', 'Spain', 'Switzerland', 'Other',
];

function readConfig(block) {
  const config = {};
  const intro = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const valueCell = cells[1];
      if (key === 'faq') {
        const link = valueCell.querySelector('a');
        if (link) config.faq = { href: link.href, label: link.textContent.trim() };
      } else {
        config[key] = valueCell.textContent.trim();
      }
    } else if (cells.length === 1 && cells[0].textContent.trim()) {
      // keep the authored cell element so its nodes can be moved (no innerHTML round-trip)
      intro.push(cells[0]);
    }
  });
  // config.intro is an array of source cell elements (authored rich text)
  config.intro = config.introCells || intro;
  return config;
}

function field(labelText, inputEl, id) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-contact-field';
  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;
  inputEl.id = id;
  inputEl.name = id;
  wrapper.append(label, inputEl);
  return wrapper;
}

export default function decorate(block) {
  const config = readConfig(block);
  block.textContent = '';

  // Anchor target for the "TALK TO US" CTAs (nav, hero tools, closing CTA all
  // link to #talk-to-us). Set the id on the block's containing section so the
  // in-page jump lands on the whole contact section, and add scroll-margin so
  // the fixed header doesn't overlap it.
  const section = block.closest('.section') || block;
  section.id = 'talk-to-us';

  const wrap = document.createElement('div');
  wrap.className = 'form-contact-inner';

  if (config.heading) {
    const h = document.createElement('h2');
    h.className = 'form-contact-title';
    h.textContent = config.heading;
    wrap.append(h);
  }
  if (config.intro && config.intro.length) {
    const introEl = document.createElement('div');
    introEl.className = 'form-contact-intro';
    // move the authored intro nodes across (preserves rich text without innerHTML)
    config.intro.forEach((cell) => {
      while (cell.firstChild) introEl.append(cell.firstChild);
    });
    wrap.append(introEl);
  }

  const form = document.createElement('form');
  form.className = 'form-contact-form';
  form.setAttribute('novalidate', '');

  const name = document.createElement('input');
  name.type = 'text';
  name.required = true;
  name.autocomplete = 'name';
  form.append(field('Full Name', name, 'form-contact-full-name'));

  const country = document.createElement('select');
  country.required = true;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Country';
  placeholder.selected = true;
  placeholder.disabled = true;
  country.append(placeholder);
  COUNTRIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    country.append(opt);
  });
  form.append(field('Country', country, 'form-contact-country'));

  const comments = document.createElement('textarea');
  comments.rows = 4;
  form.append(field('Comments', comments, 'form-contact-comments'));

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'form-contact-submit';
  submit.textContent = config.submit || 'Contact Sales';
  form.append(submit);

  const success = document.createElement('div');
  success.className = 'form-contact-success';
  success.hidden = true;
  const successHeading = document.createElement('h2');
  successHeading.textContent = config.success || 'Thank You';
  success.append(successHeading);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.hidden = true;
    success.hidden = false;
  });

  wrap.append(form, success);

  if (config.support || config.faq) {
    const contact = document.createElement('div');
    contact.className = 'form-contact-support';
    if (config.support) {
      const p = document.createElement('p');
      p.textContent = config.support;
      contact.append(p);
    }
    if (config.faq) {
      const a = document.createElement('a');
      a.href = config.faq.href;
      a.textContent = config.faq.label || 'Frequently asked questions';
      contact.append(a);
    }
    wrap.append(contact);
  }

  block.append(wrap);
}
