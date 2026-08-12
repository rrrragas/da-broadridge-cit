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

  // tools/importer/import-cit-landing.js
  var import_cit_landing_exports = {};
  __export(import_cit_landing_exports, {
    default: () => import_cit_landing_default
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

  // tools/importer/parsers/cards.js
  function cleanText(node) {
    return node ? (node.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function parseOfferings(element, tiles, document2) {
    const cells = [];
    tiles.forEach((tile) => {
      const href = tile.getAttribute("href") || "";
      const srcImg = tile.querySelector("img[src]");
      const title = cleanText(tile.querySelector("h3"));
      const subadvisor = cleanText(tile.querySelector("h5"));
      if (!title && !srcImg) return;
      let imgCell = "";
      if (srcImg) {
        const img = document2.createElement("img");
        img.setAttribute("src", srcImg.getAttribute("src"));
        img.setAttribute("alt", title || srcImg.getAttribute("alt") || "");
        imgCell = img;
      }
      const textCell = [];
      const heading = document2.createElement("h3");
      if (title && href) {
        const a = document2.createElement("a");
        a.href = href;
        a.textContent = title;
        heading.appendChild(a);
      } else if (title) {
        heading.textContent = title;
      }
      if (title) textCell.push(heading);
      if (subadvisor) {
        const p = document2.createElement("p");
        p.textContent = subadvisor;
        textCell.push(p);
      }
      cells.push([imgCell, textCell]);
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "Cards (offerings)", cells });
    element.replaceWith(block);
  }
  function parseFeature(element, document2) {
    const cells = [];
    let columns = [...element.querySelectorAll(":scope > .et_pb_column")];
    if (!columns.length) columns = [...element.querySelectorAll(".et_pb_column")];
    columns.forEach((col) => {
      const anchor = col.querySelector("a[href]");
      const href = anchor ? anchor.getAttribute("href") : "";
      const scope = col.querySelector(".et_pb_text_inner") || anchor || col;
      scope.querySelectorAll(".ephox-sloth-bin").forEach((n) => n.remove());
      const headings = [...scope.querySelectorAll("h1, h2, h3, h4, h5, h6")];
      const titleText = headings.length ? headings[0].textContent.replace(/\s+/g, " ").trim() : "";
      if (headings.length) headings[0].remove();
      const bodyText = scope.textContent.replace(/\s+/g, " ").trim();
      if (!titleText && !bodyText) return;
      const cell = [];
      const heading = document2.createElement("h3");
      if (titleText && href) {
        const a = document2.createElement("a");
        a.href = href;
        a.textContent = titleText;
        heading.appendChild(a);
      } else {
        heading.textContent = titleText;
      }
      if (titleText) cell.push(heading);
      if (bodyText) {
        const p = document2.createElement("p");
        p.textContent = bodyText;
        cell.push(p);
      }
      cells.push([cell]);
    });
    if (cells.length <= 1) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "Cards (feature)", cells });
    element.replaceWith(block);
  }
  function parse2(element, { document: document2 }) {
    const tiles = [...element.querySelectorAll("a.box-cover")];
    if (tiles.length) {
      parseOfferings(element, tiles, document2);
      return;
    }
    parseFeature(element, document2);
  }

  // tools/importer/parsers/form-contact.js
  function parse3(element, { document: document2 }) {
    const pick = (sel) => {
      const el = element.querySelector(sel);
      return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
    };
    const heading = pick('.talk-to-us__form__title, h3[class*="form__title"]') || "Talk to us";
    const submit = pick("#talk-to-us__submit, button.cta") || "Contact Sales";
    const supportLabel = pick(".top_contact_info > p, .talk-to-us__contact-info p") || "Matrix Trust client support:";
    let phone = "";
    const cit = element.querySelector(".talk-to-us__cit-contact");
    if (cit) {
      const h4 = cit.querySelector("h4");
      if (h4) {
        const raw = h4.childNodes[0] && h4.childNodes[0].textContent || h4.textContent;
        phone = raw.replace(/\s+/g, " ").trim();
      }
    }
    if (!phone) phone = "+1 888 947 3472";
    const support = `${supportLabel.replace(/:\s*$/, "")}: ${phone}`;
    const faqAnchor = element.querySelector('a[href*="faq"]') || element.querySelector(".talk-to-us__cit-contact a[href]");
    const faqHref = faqAnchor ? faqAnchor.getAttribute("href") : "https://www.broadridge.com/client-access/matrix-trust-company-faq";
    const faqLabel = (faqAnchor ? faqAnchor.textContent.replace(/\s+/g, " ").trim() : "") || "Frequently asked questions";
    const success = pick('#thank-you-placeholder-138334 .talk-to-us__form__title, [id^="thank-you-placeholder"] .talk-to-us__form__title') || "Thank You";
    const faqLink = document2.createElement("a");
    faqLink.href = faqHref;
    faqLink.textContent = faqLabel;
    const cells = [
      ["Heading", heading],
      ["Submit", submit],
      ["Support", support],
      ["FAQ", faqLink],
      ["Success", success]
    ];
    const block = WebImporter.Blocks.createBlock(document2, { name: "form-contact", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns.js
  function cleanText2(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }
  function buildList(srcList, document2) {
    const tag = srcList.tagName.toLowerCase() === "ol" ? "ol" : "ul";
    const list = document2.createElement(tag);
    [...srcList.querySelectorAll(":scope > li")].forEach((li) => {
      const text = cleanText2(li);
      if (!text) return;
      const nli = document2.createElement("li");
      nli.textContent = text;
      list.appendChild(nli);
    });
    return list.children.length ? list : null;
  }
  function pushCleaned(node, document2, out) {
    const tag = (node.tagName || "").toLowerCase();
    if (!tag) return;
    if (tag === "ul" || tag === "ol") {
      const list = buildList(node, document2);
      if (list) out.push(list);
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      if (node.querySelector("p, div, ul, ol")) {
        [...node.children].forEach((c) => pushCleaned(c, document2, out));
        return;
      }
      const text = cleanText2(node);
      if (!text) return;
      const level = tag === "h1" ? "h2" : tag;
      const h = document2.createElement(level);
      h.textContent = text;
      out.push(h);
      return;
    }
    if (tag === "p") {
      const text = cleanText2(node);
      if (text) {
        const p = document2.createElement("p");
        p.textContent = text;
        out.push(p);
      }
      return;
    }
    if (tag === "div") {
      [...node.children].forEach((c) => pushCleaned(c, document2, out));
    }
  }
  function collectTextColumn(col, document2) {
    const out = [];
    const inners = [...col.querySelectorAll(".et_pb_text_inner")];
    const scopes = inners.length ? inners : [col];
    scopes.forEach((inner) => {
      [...inner.children].forEach((node) => pushCleaned(node, document2, out));
    });
    const btn = col.querySelector("a.et_pb_button, a.open-talk-to-us, .et_pb_button_module_wrapper a[href]");
    if (btn) {
      const label = cleanText2(btn);
      if (label) {
        let href = btn.getAttribute("href") || "";
        if (!href || href === "#" || /^javascript:/i.test(href)) href = "#talk-to-us";
        const a = document2.createElement("a");
        a.href = href;
        a.textContent = label;
        const p = document2.createElement("p");
        p.appendChild(a);
        out.push(p);
      }
    }
    return out;
  }
  function buildCompareColumn(col, document2) {
    const cell = [];
    const scope = col.querySelector(".et_pb_text_inner") || col;
    const srcHeading = scope.querySelector("h1, h2, h3, h4, h5, h6");
    if (srcHeading) {
      const text = cleanText2(srcHeading);
      if (text) {
        const h = document2.createElement("h3");
        h.textContent = text;
        cell.push(h);
      }
    }
    const items = [];
    scope.querySelectorAll("ul li, ol li").forEach((li) => {
      const text = cleanText2(li).replace(/^[✓✔✗✘•\-–\s]+/, "").trim();
      if (text) items.push(text);
    });
    if (items.length) {
      const ul = document2.createElement("ul");
      items.forEach((t) => {
        const li = document2.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      });
      cell.push(ul);
    }
    return cell;
  }
  function hasCompareHeading(col) {
    const heading = col.querySelector("h1, h2, h3, h4, h5, h6");
    if (!heading) return false;
    const text = cleanText2(heading).toLowerCase();
    return /\bare\s*:$/.test(text) || /\bare\s+not\s*:$/.test(text);
  }
  function isCompare(columns) {
    const textCols = columns.filter((c) => !c.querySelector("img[src]"));
    if (textCols.length < 2) return false;
    if (!textCols.every((c) => c.querySelector("ul li, ol li"))) return false;
    const hasCompareClasses = columns.some((c) => c.querySelector("ul.checks, ul.exes"));
    const hasCompareHeadings = textCols.some((c) => hasCompareHeading(c));
    return hasCompareClasses || hasCompareHeadings;
  }
  function parse4(element, { document: document2 }) {
    let columns = [...element.querySelectorAll(":scope > .et_pb_column")];
    if (!columns.length) columns = [...element.querySelectorAll(".et_pb_column")];
    if (isCompare(columns)) {
      const cellsRow = columns.map((col) => buildCompareColumn(col, document2)).filter((c) => c.length);
      if (!cellsRow.length) {
        element.replaceWith(...element.childNodes);
        return;
      }
      const block2 = WebImporter.Blocks.createBlock(document2, {
        name: "Columns (compare)",
        cells: [cellsRow]
      });
      element.replaceWith(block2);
      return;
    }
    const imageCols = columns.filter((c) => c.querySelector("img[src]"));
    const textOnlyCols = columns.filter((c) => !c.querySelector("img[src]"));
    if (columns.length >= 2 && imageCols.length === 0 && textOnlyCols.length >= 2) {
      const row = textOnlyCols.map((col) => {
        const cell = collectTextColumn(col, document2);
        return cell.length ? cell : "";
      });
      if (row.some((c) => c && c.length)) {
        const block2 = WebImporter.Blocks.createBlock(document2, { name: "Columns", cells: [row] });
        element.replaceWith(block2);
        return;
      }
    }
    const textCell = [];
    let imageEl = null;
    if (columns.length) {
      columns.forEach((col) => {
        const img = col.querySelector("img[src]");
        if (img && !imageEl) {
          imageEl = img;
        } else if (!img) {
          textCell.push(...collectTextColumn(col, document2));
        }
      });
    } else {
      textCell.push(...collectTextColumn(element, document2));
    }
    if (!textCell.length && !imageEl) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = imageEl ? [[textCell.length ? textCell : "", imageEl]] : [[textCell.length ? textCell : ""]];
    const block = WebImporter.Blocks.createBlock(document2, { name: "Columns", cells });
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
      const headings = [...element.querySelectorAll("h1, h2, h3, h4, h5, h6")];
      const stack = [];
      headings.forEach((h) => {
        const src = Number(h.tagName[1]);
        while (stack.length && stack[stack.length - 1].src >= src) stack.pop();
        const out = Math.min(stack.length ? stack[stack.length - 1].out + 1 : 1, 6);
        stack.push({ src, out });
        if (out !== src) {
          const nh = element.ownerDocument.createElement(`h${out}`);
          nh.innerHTML = h.innerHTML;
          h.replaceWith(nh);
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

  // tools/importer/import-cit-landing.js
  var parsers = {
    "hero-banner": parse,
    cards: parse2,
    "form-contact": parse3,
    columns: parse4
  };
  var PAGE_TEMPLATE = {
    name: "cit-landing",
    description: "CIT landing page: hero-banner, definition default content, cards (feature), form-contact, columns (media + compare). Shared header nav and footer chrome.",
    urls: [
      "https://www.broadridge.com/cit/"
    ],
    blocks: [
      {
        name: "hero-banner",
        instances: [
          "#main-content > section.et_pb_fullwidth_header_0",
          "section.et_pb_fullwidth_header_0"
        ]
      },
      {
        name: "cards",
        instances: [
          "#main-content > div.et_pb_section_1.welcomeSection div.et_pb_row_1.et_pb_equal_columns",
          ".welcomeSection .et_pb_row_1.et_pb_equal_columns"
        ]
      },
      {
        name: "form-contact",
        instances: [
          "#talk-to-us"
        ]
      },
      {
        name: "columns",
        instances: [
          "#main-content > div.et_pb_section_2 > div.et_pb_row_2",
          "#main-content > div.et_pb_section_2 > div.et_pb_row_4",
          "#page-container > div.et_pb_section_3 > div.et_pb_row"
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
        defaultContent: []
      },
      {
        id: "s2",
        name: "Definition and Feature Cards",
        selector: ["#main-content > div.et_pb_section_1.welcomeSection"],
        style: "light-grey",
        blocks: ["cards"],
        defaultContent: [".welcomeSection .et_pb_row_0 .et_pb_text"]
      },
      {
        id: "s3",
        name: "Characteristics",
        selector: ["#main-content > div.et_pb_section_2"],
        style: "light-grey",
        blocks: ["columns"],
        defaultContent: []
      },
      {
        id: "s4",
        name: "Closing CTA",
        selector: ["#page-container > div.et_pb_section_3"],
        style: "light-grey",
        blocks: ["columns"],
        defaultContent: []
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
  var import_cit_landing_default = {
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
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
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
  return __toCommonJS(import_cit_landing_exports);
})();
