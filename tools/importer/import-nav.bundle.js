/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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

  // tools/importer/import-nav.js
  var import_nav_exports = {};
  __export(import_nav_exports, {
    default: () => import_nav_default
  });

  // tools/importer/parsers/nav.js
  var BRAND = {
    href: "/cit/",
    img: "https://www.broadridge.com/cit/_assets/images/2023/br.com-sprint-17-matrix.png",
    alt: "Matrix Trust Company"
  };
  var SECTIONS = [
    { label: "HOME", href: "/cit/" },
    { label: "CIT SERVICES", href: "/cit/cit-services" },
    { label: "MATRIX CITs", href: "/cit/matrix-cits" },
    {
      label: "MATRIX SOLUTIONS",
      href: null,
      children: [
        { label: "Broker-Dealers", href: "/cit/broker-dealer-platform" },
        { label: "Banks & Trusts", href: "/cit/banks-and-trusts" },
        { label: "TPAs & Recordkeepers", href: "/cit/tpas-and-record-keepers" },
        { label: "Financial Advisers", href: "/cit/financial-advisers" }
      ]
    },
    { label: "ABOUT US", href: "/cit/about-us" },
    { label: "TALK TO US", href: "#talk-to-us" }
  ];
  var TOOLS = { label: "TALK TO US", href: "#talk-to-us" };
  function makeLink(doc, { href, label }) {
    const a = doc.createElement("a");
    a.href = href;
    a.textContent = label;
    return a;
  }
  function buildNav(doc) {
    const main = doc.createElement("main");
    const brandP = doc.createElement("p");
    const brandA = doc.createElement("a");
    brandA.href = BRAND.href;
    const img = doc.createElement("img");
    img.src = BRAND.img;
    img.alt = BRAND.alt;
    brandA.append(img);
    brandP.append(brandA);
    main.append(brandP);
    main.append(doc.createElement("hr"));
    const ul = doc.createElement("ul");
    SECTIONS.forEach((item) => {
      const li = doc.createElement("li");
      if (item.href) {
        li.append(makeLink(doc, item));
      } else {
        li.append(doc.createTextNode(item.label));
      }
      if (Array.isArray(item.children) && item.children.length) {
        const sub = doc.createElement("ul");
        item.children.forEach((child) => {
          const subLi = doc.createElement("li");
          subLi.append(makeLink(doc, child));
          sub.append(subLi);
        });
        li.append(sub);
      }
      ul.append(li);
    });
    main.append(ul);
    main.append(doc.createElement("hr"));
    const toolsP = doc.createElement("p");
    toolsP.append(makeLink(doc, TOOLS));
    main.append(toolsP);
    return main;
  }

  // tools/importer/import-nav.js
  var import_nav_default = {
    transform: (payload) => {
      const { document } = payload;
      const main = buildNav(document);
      return [{
        element: main,
        path: "/nav",
        report: {
          title: "Navigation",
          type: "chrome"
        }
      }];
    }
  };
  return __toCommonJS(import_nav_exports);
})();
