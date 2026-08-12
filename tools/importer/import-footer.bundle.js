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

  // tools/importer/import-footer.js
  var import_footer_exports = {};
  __export(import_footer_exports, {
    default: () => import_footer_default
  });

  // tools/importer/parsers/footer.js
  var LINK_GROUPS = [
    {
      title: "Matrix Trust",
      links: [
        { label: "Home", href: "/cit/" },
        { label: "CIT Service", href: "/cit/cit-services" },
        { label: "Matrix CITs", href: "/cit/matrix-cits" },
        { label: "About Us", href: "/cit/about-us" },
        { label: "Matrix Terms of Service", href: "/cit/terms-and-conditions" }
      ]
    },
    {
      title: "Matrix Solutions",
      links: [
        { label: "Broker-Dealers", href: "/cit/broker-dealer-platform" },
        { label: "Banks & Trusts", href: "/cit/banks-and-trusts" },
        { label: "TPAs & Recordkeepers", href: "/cit/tpas-and-record-keepers" },
        { label: "Financial Advisers", href: "/cit/financial-advisers" }
      ]
    }
  ];
  var SOCIAL = [
    { label: "Facebook", href: "https://www.facebook.com/BroadridgeCareers" },
    { label: "Twitter", href: "https://twitter.com/broadridge" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/broadridge-financial-solutions" },
    { label: "YouTube", href: "https://www.youtube.com/c/broadridge" }
  ];
  var COPYRIGHT = "\xA9 2026 Broadridge Financial Solutions, Inc. All Rights Reserved.";
  var LEGAL = [
    "Terms of Use & Linking Policy",
    "Accessibility Statement",
    "Legal Statements",
    "Privacy Statement",
    "Do Not Sell My Personal Information",
    "Your Privacy Choices"
  ];
  function makeLink(doc, { href, label }) {
    const a = doc.createElement("a");
    a.href = href;
    a.textContent = label;
    return a;
  }
  function buildFooter(doc) {
    const main = doc.createElement("main");
    LINK_GROUPS.forEach((group) => {
      const h = doc.createElement("h3");
      h.textContent = group.title;
      main.append(h);
      const ul = doc.createElement("ul");
      group.links.forEach((link) => {
        const li = doc.createElement("li");
        li.append(makeLink(doc, link));
        ul.append(li);
      });
      main.append(ul);
    });
    main.append(doc.createElement("hr"));
    const socialP = doc.createElement("p");
    SOCIAL.forEach((s, i) => {
      if (i > 0) socialP.append(doc.createTextNode(" "));
      socialP.append(makeLink(doc, s));
    });
    main.append(socialP);
    const copyP = doc.createElement("p");
    copyP.textContent = COPYRIGHT;
    main.append(copyP);
    const legalP = doc.createElement("p");
    LEGAL.forEach((label, i) => {
      if (i > 0) legalP.append(doc.createTextNode(" / "));
      legalP.append(makeLink(doc, { href: "#", label }));
    });
    main.append(legalP);
    return main;
  }

  // tools/importer/import-footer.js
  var import_footer_default = {
    transform: (payload) => {
      const { document } = payload;
      const main = buildFooter(document);
      return [{
        element: main,
        path: "/footer",
        report: {
          title: "Footer",
          type: "chrome"
        }
      }];
    }
  };
  return __toCommonJS(import_footer_exports);
})();
