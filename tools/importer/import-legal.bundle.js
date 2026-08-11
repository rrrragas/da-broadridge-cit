/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-legal.js
  var import_legal_exports = {};
  __export(import_legal_exports, {
    default: () => import_legal_default
  });

  // tools/importer/parsers/hero-banner.js
  function parse(element, { document: document2 }) {
    const cells = [];
    let bgImage = element.querySelector(":scope > img[src]") || element.querySelector("img[src]");
    if (!bgImage) {
      const styled = element.matches('[style*="background-image"]') ? element : element.querySelector('[style*="background-image"]');
      const style = styled ? styled.getAttribute("style") || "" : "";
      const match = style.match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
      if (match && match[2]) {
        let src = match[2].trim();
        try {
          src = new URL(src, document2.baseURI).href;
        } catch (e) {
        }
        bgImage = document2.createElement("img");
        bgImage.src = src;
        bgImage.alt = "Collective Investment Trusts";
      }
    }
    if (bgImage) cells.push([bgImage]);
    const heading = element.querySelector("h1.et_pb_module_header, .header-content h1, h1");
    const subhead = element.querySelector(
      '.et_pb_fullwidth_header_subhead, span[class*="subhead"], .header-content p'
    );
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (subhead && subhead.textContent.trim()) {
      const p = document2.createElement("p");
      p.textContent = subhead.textContent.replace(/\s+/g, " ").trim();
      contentCell.push(p);
    }
    if (!bgImage && contentCell.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    if (contentCell.length) cells.push([contentCell]);
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero-banner", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/broadridge-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function cleanLinkLabel(a) {
    const clone = a.cloneNode(true);
    clone.querySelectorAll('[style*="display"]').forEach((n) => {
      if (/display\s*:\s*none/i.test(n.getAttribute("style") || "")) n.remove();
    });
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }
  function buildLinkList(anchors, doc) {
    const ul = doc.createElement("ul");
    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const label = cleanLinkLabel(a);
      if (!label) return;
      const na = doc.createElement("a");
      na.setAttribute("href", href);
      na.textContent = label;
      const li = doc.createElement("li");
      li.appendChild(na);
      ul.appendChild(li);
    });
    return ul.children.length ? ul : null;
  }
  function normalizeFundPage(element) {
    const dividedWelcome = element.querySelector("section.divided-welcome");
    if (!dividedWelcome) return;
    const doc = element.ownerDocument;
    const hero = element.querySelector("section.et_pb_fullwidth_header_0");
    const noteBand = hero && hero.querySelector(".et_pb_fullwidth_header_scroll");
    if (hero && noteBand) {
      const noteWrap = doc.createElement("div");
      noteWrap.className = "fund-note";
      noteBand.querySelectorAll("p").forEach((p) => {
        if (!(p.textContent || "").replace(/\s+/g, " ").trim()) return;
        const np = doc.createElement("p");
        np.innerHTML = p.innerHTML;
        noteWrap.appendChild(np);
      });
      if (noteWrap.children.length) hero.after(noteWrap);
      noteBand.remove();
    }
    const subLink = dividedWelcome.parentElement && dividedWelcome.parentElement.querySelector("div.et_pb_section_1.welcomeSection a[onclick]");
    if (subLink && !subLink.getAttribute("href")) {
      const popupLink = element.querySelector('#disclaimer-notice a[href^="http"]');
      if (popupLink) subLink.setAttribute("href", popupLink.getAttribute("href"));
      subLink.removeAttribute("onclick");
    }
    const descScopes = [
      ...dividedWelcome.querySelectorAll(".left-side h1, .left-side h2, .left-side h3, .left-side h4")
    ];
    const subSection = dividedWelcome.parentElement && dividedWelcome.parentElement.querySelector("div.et_pb_section_1.welcomeSection");
    if (subSection) {
      descScopes.push(...subSection.querySelectorAll("h3, h4"));
    }
    descScopes.forEach((h) => {
      if (!h.querySelector("p")) return;
      const frag = doc.createDocumentFragment();
      [...h.children].filter((c) => c.tagName === "P").forEach((p) => {
        if (!(p.textContent || "").replace(/\s+/g, " ").trim()) return;
        const np = doc.createElement("p");
        np.innerHTML = p.innerHTML;
        frag.appendChild(np);
      });
      if (frag.childNodes.length) h.replaceWith(frag);
      else h.remove();
    });
    dividedWelcome.querySelectorAll(".right-side ul").forEach((ul) => {
      const anchors = [...ul.querySelectorAll(":scope > li a[href]")];
      const newUl = buildLinkList(anchors, doc);
      if (newUl) ul.replaceWith(newUl);
      else ul.remove();
    });
    dividedWelcome.querySelectorAll(".right-side small").forEach((s) => {
      if (!(s.textContent || "").trim()) s.remove();
    });
    const blueprintSecs = [...element.querySelectorAll("section.blue-prints")];
    if (blueprintSecs.length) {
      const target = blueprintSecs[0];
      blueprintSecs.forEach((sec) => {
        const container = sec.querySelector(".blue-prints-container") || sec;
        const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
        const anchors = [...sec.querySelectorAll(".blueprint-links a[href]")];
        const frag = doc.createDocumentFragment();
        if (heading) {
          const text = (heading.textContent || "").replace(/\s+/g, " ").trim();
          if (text) {
            const h = doc.createElement("h2");
            h.textContent = text;
            frag.appendChild(h);
          }
        }
        const ul = buildLinkList(anchors, doc);
        if (ul) frag.appendChild(ul);
        if (sec === target) {
          sec.innerHTML = "";
          sec.appendChild(frag);
        } else {
          target.appendChild(frag);
          sec.remove();
        }
      });
    }
  }
  function normalizeLegalPage(element) {
    const conditions = element.querySelector("div.et_pb_text_inner-conditions");
    if (!conditions) return;
    const doc = element.ownerDocument;
    WebImporter.DOMUtils.remove(element, ["#talk-to-us"]);
    [...conditions.querySelectorAll(":scope > p")].forEach((p) => {
      if (!p.querySelector("strong")) return;
      const clone = p.cloneNode(true);
      clone.querySelectorAll("strong").forEach((s) => s.remove());
      const outside = (clone.textContent || "").replace(/\s+/g, " ").trim();
      if (outside !== "") return;
      const text = (p.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      const h = doc.createElement("h2");
      h.textContent = text;
      p.replaceWith(h);
    });
  }
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        "#onetrust-consent-sdk",
        "#onetrust-banner-sdk",
        "#ot-sdk-btn-floating"
      ]);
      normalizeFundPage(element);
      normalizeLegalPage(element);
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        // Shared header/footer chrome (migrated separately as nav/footer docs).
        "#main-header",
        // cleaned.html L31 site header + top nav
        "header",
        // defensive: any remaining header chrome
        "footer",
        // cleaned.html L741 footer (also drops Ready-for-Next logo + stock-ticker arrow)
        // Utility "skip-link"/geolocation wrapper = body's first div child.
        // Per-page UUID id (snippet_<uuid>), so match by prefix for reuse across pages.
        'div[id^="snippet_"]',
        // cleaned.html L26 wrapper
        "#geolocation",
        // cleaned.html L27 geolocation data (defensive)
        // Tracking pixels/beacons (per-page numeric ids -> prefix match).
        '[id^="batBeacon"]',
        // cleaned.html L1134 Bing UET beacon + pixel img
        // Inline scripts / styles / embeds (non-authorable framework cruft).
        "script",
        "noscript",
        "style",
        "link",
        "iframe"
      ]);
      WebImporter.DOMUtils.remove(element, [
        "#disclaimer-notice",
        // empty consent popup nested in welcomeSection
        "#main-content > div.overlay"
        // dimming overlay for the popups
      ]);
      element.querySelectorAll("#legal-notice .et_pb_button_module_wrapper, #legal-notice .et_pb_row_1").forEach((n) => n.remove());
      const CONTROL_TEXT = /^(i\s+)?(accept|decline|continue|agree|close|reject all|accept all)$/i;
      element.querySelectorAll("a, button, p, span, div").forEach((el) => {
        if (el.children.length > 0) return;
        const txt = (el.textContent || "").trim();
        if (CONTROL_TEXT.test(txt)) el.remove();
      });
      element.querySelectorAll('a.box-cover[href$=".pdf"], a.box-cover[href*="/pdf/"]').forEach((a) => {
        const doc = element.ownerDocument;
        const href = a.getAttribute("href") || "";
        const labelSrc = a.querySelector("h1, h2, h3, h4, h5, h6") || a;
        const label = (labelSrc.textContent || "").replace(/\s+/g, " ").trim() || "Download";
        const link = doc.createElement("a");
        link.setAttribute("href", href);
        link.textContent = label;
        const p = doc.createElement("p");
        p.appendChild(link);
        a.replaceWith(p);
      });
      element.querySelectorAll("li h1, li h2, li h3, li h4, li h5, li h6").forEach((h) => {
        h.replaceWith(...h.childNodes);
      });
      const JUNK_HEADING = /^[\s \-–—•·.]*$/;
      element.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
        if (h.closest("table")) return;
        const clone = h.cloneNode(true);
        clone.querySelectorAll('[style*="display"]').forEach((n) => {
          if (/display\s*:\s*none/i.test(n.getAttribute("style") || "")) n.remove();
        });
        const visible = (clone.textContent || "").replace(/ /g, " ").trim();
        if (visible === "" || JUNK_HEADING.test(visible)) h.remove();
      });
      element.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
        if (h.closest("table")) return;
        const inner = h.querySelector("h1, h2, h3, h4, h5, h6");
        if (!inner) return;
        const ownClone = h.cloneNode(true);
        ownClone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((n) => n.remove());
        ownClone.querySelectorAll('[style*="display"]').forEach((n) => {
          if (/display\s*:\s*none/i.test(n.getAttribute("style") || "")) n.remove();
        });
        const outerOwn = (ownClone.textContent || "").replace(/ /g, " ").trim();
        if (outerOwn !== "" && !JUNK_HEADING.test(outerOwn)) return;
        const text = (inner.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) return;
        const level = h.tagName.toLowerCase();
        const replacement = element.ownerDocument.createElement(level);
        replacement.textContent = text;
        h.replaceWith(replacement);
      });
      element.querySelectorAll("h1").forEach((h) => {
        if (h.closest("table") || h.closest(".et_pb_fullwidth_header")) return;
        const h2 = element.ownerDocument.createElement("h2");
        h2.innerHTML = h.innerHTML;
        h.replaceWith(h2);
      });
      element.querySelectorAll("h3, h4").forEach((h) => {
        const txt = (h.textContent || "").trim();
        if (txt.length > 180) {
          const p = element.ownerDocument.createElement("p");
          p.innerHTML = h.innerHTML;
          h.replaceWith(p);
        }
      });
    }
  }

  // tools/importer/transformers/broadridge-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
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
  function transform2(hookName, element, payload) {
    const doc = element.ownerDocument || document;
    if (hookName === TransformHook2.beforeTransform) {
      const formSource = element.querySelector("#talk-to-us");
      if (formSource) {
        element.append(formSource);
      }
    }
    if (hookName === TransformHook2.afterTransform) {
      const sections = payload && payload.template && payload.template.sections;
      if (!sections || sections.length < 2) return;
      const formBlock = element.querySelector(".form-contact") || element.querySelector("#talk-to-us");
      if (formBlock && formBlock.previousElementSibling && formBlock.previousElementSibling.tagName !== "HR") {
        formBlock.before(doc.createElement("hr"));
      }
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        const sectionEl = findSectionElement(element, section);
        if (!sectionEl) continue;
        if (section.style) {
          const metadata = WebImporter.Blocks.createBlock(doc, {
            name: "Section Metadata",
            cells: { Style: section.style }
          });
          sectionEl.after(metadata);
        }
        if (i > 0) {
          sectionEl.before(doc.createElement("hr"));
        }
      }
    }
  }

  // tools/importer/import-legal.js
  var parsers = {
    "hero-banner": parse
  };
  var PAGE_TEMPLATE = {
    name: "legal",
    description: 'CIT legal page (Matrix Terms of Service): hero-banner (H1 "Matrix Terms of Service", background image, empty subhead), then the full Terms body as DEFAULT CONTENT \u2014 the opening acceptance statement, defined-terms paragraph, and ten legal sections (Hyperlinks to Third-Party Information and Value-Added Services; Matrix Company Does Not Provide Financial, Investment, Tax or Legal Advice on this Web Site; Arbitration and Governing Law Provisions [Denver, Colorado]; Acceptable Use; Security/Privacy; Disclosure of User Information; Downtime and Interruptions in Service; Termination; Modification; General Provisions) plus the closing CIT-risk paragraph with a /cit/matrix-cits link. The section headings are authored as bold-only paragraphs and promoted to <h2> by the legal-page normalization in broadridge-cleanup.js (guarded on div.et_pb_text_inner-conditions, a strict no-op on every other CIT page). No closing CTA and no Talk-to-Us form on this page \u2014 the shared #talk-to-us flyout chrome is removed. Shared header nav and footer chrome. Reuses the cit-landing hero-banner parser and the shared cleanup/sections transformers; adds no new blocks.',
    urls: [
      "https://www.broadridge.com/cit/terms-and-conditions"
    ],
    coverageGaps: [],
    blocks: [
      {
        name: "hero-banner",
        instances: [
          "#main-content > section.et_pb_fullwidth_header_0",
          "section.et_pb_fullwidth_header_0"
        ]
      }
    ],
    sections: [
      {
        id: "s1",
        name: "Hero",
        selector: ["#main-content > section.et_pb_fullwidth_header_0"],
        style: null,
        blocks: ["hero-banner"],
        defaultContent: [],
        hint: "block"
      },
      {
        id: "s2",
        name: "Terms of Service Body",
        selector: ["#main-content > div.et_pb_section_1"],
        style: "light-grey",
        blocks: [],
        defaultContent: ["#main-content > div.et_pb_section_1 div.et_pb_text_inner-conditions"],
        hint: "default-content"
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), { template: PAGE_TEMPLATE });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document2, template) {
    const pageBlocks = [];
    const seen = /* @__PURE__ */ new Set();
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((selector) => {
        const elements = document2.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
        }
        elements.forEach((element) => {
          if (seen.has(element)) return;
          seen.add(element);
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_legal_default = {
    transform: (payload) => {
      const {
        document: document2,
        url,
        html,
        params
      } = payload;
      const main = document2.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document2, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document: document2, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document2.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document2);
      WebImporter.rules.transformBackgroundImages(main, document2);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const pathname = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const slug = pathname.split("/").filter(Boolean).pop() || "index";
      const path = WebImporter.FileUtils.sanitizePath(`/${slug}`);
      return [{
        element: main,
        path,
        report: {
          title: document2.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_legal_exports);
})();
