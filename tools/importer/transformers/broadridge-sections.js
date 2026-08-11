/* eslint-disable */
/* global WebImporter, document */

/**
 * Transformer: Broadridge (CIT / Divi) section breaks + section metadata.
 *
 * Driven entirely by payload.template.sections (from page-templates.json).
 * For each section (processed in reverse document order so insertions don't
 * disturb later lookups):
 *   - insert an <hr> section break before the section wrapper (every section
 *     except the first), and
 *   - insert a "Section Metadata" block (Style: <style>) immediately after the
 *     section wrapper when the section defines a style.
 *
 * Section wrapper selectors come from the template (verified against
 * migration-work/cleaned.html): hero section L489, welcomeSection L508,
 * et_pb_section_2 L591 (all under #main-content); et_pb_section_3 L707 under
 * #page-container (sibling of #main-content). Document order: s1 < s2 < s3 < s4.
 *
 * cit-landing expects: 3 <hr> breaks and 3 Section Metadata blocks (s1 hero has
 * no style; s2/s3/s4 are light-grey).
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

// Resolve a section's wrapper element from its (array of) template selectors.
function findSectionElement(element, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (let i = 0; i < selectors.length; i += 1) {
    const sel = selectors[i];
    if (sel) {
      const found = element.querySelector(sel);
      if (found) return found;
    }
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const doc = element.ownerDocument || document;

  if (hookName === TransformHook.beforeTransform) {
    // The "Talk to Us" form is a modal in the source — a direct child of <body>
    // (sibling of #main-content), so it renders near the TOP of the imported
    // page. As canonical content it belongs in its own section at the END: the
    // closing-CTA "TALK TO US" button links to #talk-to-us, and the form block's
    // "Talk to us" heading generates that anchor id. Move the SOURCE element to
    // the end BEFORE parsing so the parser output lands last in document order.
    const formSource = element.querySelector('#talk-to-us');
    if (formSource) {
      element.append(formSource);
    }
  }

  if (hookName === TransformHook.afterTransform) {
    const sections = payload && payload.template && payload.template.sections;
    if (!sections || sections.length < 2) return;

    // Section break before the relocated form-contact block so it becomes its
    // own trailing section (the parser converts #talk-to-us into .form-contact).
    const formBlock = element.querySelector('.form-contact')
      || element.querySelector('#talk-to-us');
    if (formBlock && formBlock.previousElementSibling
        && formBlock.previousElementSibling.tagName !== 'HR') {
      formBlock.before(doc.createElement('hr'));
    }

    // Reverse order so earlier sections' elements stay locatable after inserts.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const sectionEl = findSectionElement(element, section);
      if (!sectionEl) continue;

      // Section Metadata block for sections that declare a style.
      if (section.style) {
        const metadata = WebImporter.Blocks.createBlock(doc, {
          name: 'Section Metadata',
          cells: { Style: section.style },
        });
        sectionEl.after(metadata);
      }

      // Section break before every section except the first.
      if (i > 0) {
        sectionEl.before(doc.createElement('hr'));
      }
    }
  }
}
