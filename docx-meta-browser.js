// docx-meta-browser.js
// Extracts JATS-like manuscript metadata + structural inventory (front matter,
// section tree, tables, figures, equations, style usage, references) straight
// from the raw .docx OOXML (via JSZip). Runs entirely in the browser.
//
// This complements crossref-core-browser.js: mammoth gives prose HTML for the
// citation audit, while this module reads the underlying XML (document.xml,
// styles.xml, numbering.xml, core.xml, app.xml) to answer "what is this
// manuscript made of" for a copyeditor, in a journal-editing sense.
//
// Math handling: BOTH native Office Math (<m:oMath>, OMML) AND MathType /
// Equation Editor equations (MathType is stored as an OLE <w:object> whose
// ProgID is "Equation.DSMT4", with an embedded binary + metafile preview) are
// recognised and counted separately, so a CE can see how much math a paper
// carries and whether it's native or legacy-equation-editor math.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.docxMeta = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var XML = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var NS_RE = /xmlns:(\w+)="([^"]+)"/g;

  // ---- Semantic map for the journal template style codes seen in real
  // manuscripts (Sage "Medical Decision Making" / similar submission
  // templates ship paragraph styles with cryptic one-to-four letter IDs).
  // Unknown styles fall back to the style's own w:name (or the id itself).
  var STYLE_LABELS = {
    H1: "Heading 1", H2: "Heading 2", H3: "Heading 3", H4: "Heading 4",
    H5: "Heading 5", H6: "Heading 6",
    TT: "Table cell text", TCH: "Table column header", TY0: "Article type line",
    DOI0: "DOI line", LRH0: "Running head (left)", RRH0: "Running head (right)",
    AU0: "Author name", AN: "Author note / back-matter text",
    AF: "Affiliation / funding", AT: "Article title", AS: "Article subtitle",
    ABKW: "Abstract / keywords text", ABKWH: "Keywords heading",
    REF: "Reference entry", TEXT: "Body text", TEXTIND: "Body text (indented)",
    EQ: "Equation", CL: "Copy-editing query", CPB: "Caption label (Table/Figure n)",
    CP: "Caption title", CPSO: "Caption source/note", EPA: "Figure caption",
    EH: "Heading (end matter)", BL: "Bullet list item", UL: "Bullet list item",
    DR: "Date received/accepted", GQ: "General query", AQ: "Author query",
    acknowledge: "Acknowledgements", FN: "Footnote"
  };

  // ---- Tiny namespace-aware XML parser. We avoid DOMParser because it can be
  // blocked/absent on file:// in some browsers; instead we tokenise the XML
  // ourselves with a stack, which is simpler and safe enough for the well
  // formed OOXML Word produces. Keeps (tag, attrs, text, children, depth).
  function parseXml(xml) {
    // Capture element start/end and text content.
    var cleaned = xml.replace(/<\?[^>]*\?>|<!--[\s\S]*?-->/g, "");
    var stack = [];
    var root = null;
    var index = 0;
    var re = /<(\/?)([A-Za-z0-9_:\-]+)((?:\s+[A-Za-z0-9_:\-]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    // NOTE: element-local recursion for <w:p> is done in a layered pass below.
    re.lastIndex = 0;
    var searchFrom = 0;
    var textBuf = "";
    var all = [];

    // Build a flat event list: {type:'open'/'close'/'text', name, attrs}
    var events = [];
    var last = 0;
    var sandbox = cleaned;
    var m;
    var pushText = function (from, to) {
      var t = sandbox.slice(from, to).replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#x([0-9A-Fa-f]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
        .replace(/&#([0-9]+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); });
      if (t && t.trim() !== "") events.push({ type: "text", text: t.replace(/\s+/g, " ").trim() });
    };
    var re2 = /<(\/?)([A-Za-z0-9_:\-]+)((?:\s+[A-Za-z0-9_:\-]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    var layers = [];
    var depthToken = 0;
    // Simpler: iterate tags, tracking depth with a stack.
    var tagStack = [];
    var top = null;
    var ptr = 0, idx;
    var nodeStack = [];
    var parseAttrs = function (s) {
      var attrs = {};
      var am = /\s+([A-Za-z0-9_:\-]+)=("[^"]*"|'[^']*')/g, km;
      while ((km = am.exec(s)) !== null) attrs[km[1]] = km[2].slice(1, -1).replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      return attrs;
    };
    var tagRe = /<(\/?)([A-Za-z0-9_:\-]+)((?:\s+[A-Za-z0-9_:\-]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    var lastIdx = 0, tm;
    while ((tm = tagRe.exec(cleaned)) !== null) {
      if (tm.index > lastIdx) pushText(lastIdx, tm.index);
      var selfClose = tm[4] === "/";
      var name = tm[2];
      var attrs = parseAttrs(tm[3]);
      if (tm[1] === "/") {
        // close
        if (nodeStack.length) {
          var closed = nodeStack.pop();
          // attach text if we have trailing text node
          if (closed) { closed._closed = true; }
        }
      } else {
        var node = { name: name, attrs: attrs, children: [], text: "", parent: nodeStack.length ? nodeStack[nodeStack.length - 1] : null };
        if (node.parent) node.parent.children.push(node);
        if (!nodeStack.length && node.parent === null) root = node;
        if (!selfClose) nodeStack.push(node); else node._closed = true;
      }
      lastIdx = tagRe.lastIndex;
    }
    if (lastIdx < cleaned.length) pushText(lastIdx, cleaned.length);
    return root;
  }

  // A more robust DOM-lite parser that preserves hierarchy. (The naive one is
  // replaced by this.) Builds a tree using an explicit stack; tags carry attrs;
  // text is accumulated on elements. Skips comments, PIs, DOCTYPE.
  function parseXmlTree(xml) {
    var s = xml
      .replace(/<\?[^>]*\?>/g, "")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    var root = null;
    var stack = [];
    // Greedy attr group (not *?) so all attributes on a tag are captured.
    var re = /<(\/?)([A-Za-z0-9_:\-]+)((?:\s+[A-Za-z0-9_:\-]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    var attrRe = /\s+([A-Za-z0-9_:\-]+)=("[^"]*"|'[^']*')/g;
    var idx = 0, m2, text = "";
    var flushText = function () {
      if (text) {
        // Remove comments/PIs up front; here we decode entities and keep
        // the raw whitespace so word-boundary segments (" ", "-", etc.) are
        // preserved across the many <w:t> runs Word splits a word into.
        var t = unescapeEntity(text);
        if (t) {
          var el = stack[stack.length - 1];
          if (el) el.text += t;
        }
      }
      text = "";
    };
    var newTag = function (name, attrStr) {
      var attrs = {};
      var km;
      attrRe.lastIndex = 0;
      while ((km = attrRe.exec(attrStr)) !== null) attrs[km[1]] = km[2].slice(1, -1);
      var node = { name: name, attrs: attrs || {}, children: [], text: "", parent: stack.length ? stack[stack.length - 1] : null };
      if (node.parent) node.parent.children.push(node);
      else root = node;
      return node;
    };
    while ((m2 = re.exec(s)) !== null) {
      // Accumulate text between the previous tag and this one.
      if (m2.index > idx) text += s.slice(idx, m2.index);
      flushText();
      if (m2[1] === "/") {
        if (stack.length) stack.pop();
      } else {
        var node = newTag(m2[2], m2[3] || "");
        if (m2[4] !== "/") stack.push(node);
      }
      idx = re.lastIndex;
    }
    if (idx < s.length) text += s.slice(idx);
    flushText();
    return root;
  }

  function unescapeEntity(t) {
    var m;
    return String(t)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x([0-9A-Fa-f]+);/g, function (_, h) { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return ""; } })
      .replace(/&#([0-9]+);/g, function (_, d) { try { return String.fromCodePoint(parseInt(d, 10)); } catch (e) { return ""; } });
  }

  function walk(node, fn) {
    if (!node) return;
    fn(node);
    for (var i = 0; i < node.children.length; i++) walk(node.children[i], fn);
  }

  function findChildren(node, name) {
    var out = [];
    if (!node) return out;
    for (var i = 0; i < node.children.length; i++) if (node.children[i].name === name) out.push(node.children[i]);
    return out;
  }

  // Collect all <w:t> descendants' text. Word breaks runs + words across many
  // <w:t> nodes ("Taste"|" "|"o"|"r"), so we join raw and let the individual
  // whitespace-only segments survive, then collapse runs of whitespace into a
  // single space (safe for prose). NFC-normalise so accented chars compare equal.
  function nodeText(node) {
    if (!node) return "";
    var parts = [];
    walk(node, function (n) {
      if (/^(?:w:t|m:t)$/.test(n.name) && n.text) parts.push(n.text);
    });
    var joined = parts.join("");
    joined = joined.replace(/\s+/g, " ");
    if (typeof joined.normalize === "function") joined = joined.normalize("NFC");
    return joined.trim();
  }

  // Runs (<w:r>) tell us the in-line character formatting. Open and close just
  // the tags that actually apply so we get clean, nesting-safe HTML. Math and
  // OLE objects are collapsed to markers that screen-read cleanly.
  function runProps(r) {
    var rPr = findFirstByName(r, "w:rPr");
    if (!rPr) return {};
    var p = {};
    function on(name) {
      var el = findFirstByName(rPr, name);
      if (!el) return false;
      var v = el.attrs ? (el.attrs["w:val"] || "") : "";
      return v.toLowerCase() !== "0" && v.toLowerCase() !== "false" && v !== "none";
    }
    if (on("w:b")) p.b = true;
    if (on("w:i")) p.i = true;
    if (on("w:u")) p.u = true;
    var va = findFirstByName(rPr, "w:vertAlign");
    if (va && va.attrs && va.attrs["w:val"]) {
      var v = va.attrs["w:val"];
      if (v === "superscript") p.sup = true;
      else if (v === "subscript") p.sub = true;
    }
    return p;
  }

  // Rich HTML for a paragraph's runs: bold / italic / underline / super & sub
  // plus footnote/endnote superscript markers and math placeholders.
  function nodeHtml(node) {
    if (!node) return "";
    var html = "";
    walkRuns(node, function (r) {
      // Skip footnote/endnote reference runs entirely (they are superscript
      // markers) but leave a visible [n] for the copyediting snapshot.
      var fn = findFirstByName(r, "w:footnoteReference");
      var en = findFirstByName(r, "w:endnoteReference");
      if (fn) { html += supMap(fn.attrs && fn.attrs["w:id"]); return; }
      if (en) { html += supMap("e" + (en.attrs && en.attrs["w:id"])); return; }
      var p = runProps(r);
      var txt = "";
      walk(r, function (n) {
        if (/^(?:w:t|m:t)$/.test(n.name) && n.text) txt += n.text;
      });
      if (!txt) return;
      txt = escapeHtml(txt);
      var open = "", close = "";
      if (p.b) { open += "<b>"; close = "</b>" + close; }
      if (p.i) { open += "<i>"; close = "</i>" + close; }
      if (p.u) { open += "<u>"; close = "</u>" + close; }
      if (p.sup) { open += "<sup>"; close = "</sup>" + close; }
      if (p.sub) { open += "<sub>"; close = "</sub>" + close; }
      html += open + txt + close;
    });
    // Collapse runs of whitespace to a single space around any tags.
    html = html.replace(/\s+/g, " ");
    return html.trim();
  }

  function supMap(id) {
    var n = String(id == null ? "" : id);
    return '<sup>[' + n + ']</sup>';
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Iterate over immediate <w:r> children of a paragraph, skipping any OLE
  // picture runs (their preview image holds no useful text).
  function walkRuns(node, cb) {
    if (!node || !node.children) return;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (c.name === "w:r" && !findFirstByName(c, "w:object")) cb(c);
    }
  }

  // ---- Main entry: arrayBuffer -> meta
  function parseDocxMeta(arrayBuffer, opts) {
    opts = opts || {};
    var out = {
      ok: true,
      front: { title: "", subtitle: "", authors: [], affiliations: [], affiliationsRich: [], abstract: { text: "", paragraphs: [], paragraphsRich: [], hasStructured: false }, keywords: [], articleType: "", doi: "", runningHeadL: "", runningHeadR: "", datesReceived: "", datesAccepted: "", wordCount: 0, paraCount: 0, pageCount: 0 },
      body: { sections: [], headings: [], paragraphCount: 0, wordCount: 0, charCount: 0, tables: [], figures: [], equations: { native: 0, mathtype: 0 }, lists: 0, imageCount: 0 },
      back: { references: [], appendix: [], acknowledgements: [], endMatter: [] },
      styles: { inventory: {}, warnings: [] },
      raw: {}
    };

    return new Promise(function (resolve, reject) {
      var self = out;
      try {
        JSZip.loadAsync(arrayBuffer).then(function (zip) {
          parseZip(zip, self).then(function () { resolve(self); }, function (e) { self.ok = false; self.error = String(e && e.message || e); resolve(self); });
        }, function (e) { out.ok = false; out.error = String(e && e.message || e); resolve(out); });
      } catch (e) {
        out.ok = false; out.error = String(e && e.message || e); resolve(out);
      }
    });
  }

  function readText(zip, path) {
    var f = zip.file(path);
    if (!f) return Promise.resolve(null);
    return f.async("string").then(function (s) { return s; });
  }

  function parseZip(zip, out) {
    var pApp = readText(zip, "docProps/app.xml");
    var pCore = readText(zip, "docProps/core.xml");
    var pDoc = readText(zip, "word/document.xml");
    var pStyles = readText(zip, "word/styles.xml");
    var pNumbering = readText(zip, "word/numbering.xml");
    var pEnd = readText(zip, "word/endnotes.xml");
    var pFoot = readText(zip, "word/footnotes.xml");
    var imgs = Object.keys(zip.files).filter(function (k) { return /^word\/media\//.test(k); });

    return Promise.all([pApp, pCore, pDoc, pStyles, pNumbering, pEnd, pFoot]).then(function (res) {
      var appXml = res[0], coreXml = res[1], docXml = res[2], stylesXml = res[3], numberingXml = res[4], endXml = res[5], footXml = res[6];

      // ---- docProps (authoritative page/word counts straight from Word) ----
      if (appXml) {
        var app = parseXmlTree(appXml);
        if (app) {
          out.front.wordCount = intOf(nodeTextChild(app, "Words"));
          out.body.wordCount = out.front.wordCount;
          out.front.pageCount = intOf(nodeTextChild(app, "Pages"));
          out.body.charCount = intOf(nodeTextChild(app, "Characters"));
          out.front.paraCount = intOf(nodeTextChild(app, "Paragraphs"));
          if (out.front.paraCount) out.body.paragraphCount = out.front.paraCount;
        }
      }
      if (coreXml) {
        var core = parseXmlTree(coreXml);
        if (core) {
          out.front.creator = nodeTextChild(core, "dc:creator");
          out.front.lastModifiedBy = nodeTextChild(core, "cp:lastModifiedBy");
          out.front.created = nodeTextChild(core, "dcterms:created");
          out.front.modified = nodeTextChild(core, "dcterms:modified");
          out.front.revision = nodeTextChild(core, "cp:revision");
          out.front.title = out.front.title || nodeTextChild(core, "dc:title");
        }
      }

      // ---- Styles inventory (styleId -> name + usage) ----
      var styleNameMap = {};
      if (stylesXml) {
        var st = parseXmlTree(stylesXml);
        if (st) {
          walk(st, function (n) {
            if (n.name === "w:style") {
              var id = n.attrs["w:styleId"];
              var nm = textOfNamedChild(n.children, "w:name", "w:val");
              if (id) styleNameMap[id] = nm || id;
            }
          });
        }
      }

      // ---- Body walk: headings, tables, figures, equations, lists, styles ----
      var docTree = docXml ? parseXmlTree(docXml) : null;
      var styleUsage = {}; // styleId -> count
      var styleOrder = []; // first-seen document order

      if (docTree) {
        var body = findFirstByName(docTree, "w:body");
        var bodyEl = body || docTree;
        var nodes = bodyEl.children;

        // Walk block-level <w:p> and <w:tbl> in document order. Figure
        // captions can follow a "[Figure N ABOUT HERE]" pointer (JAD) or the
        // figure image (MDM), so we keep a queue of pointer-figures awaiting a
        // caption in cap.pendingFigures, plus cap.pendingCaption for the next
        // table. A figure caption goes to an awaiting pointer, not to a table.
        var cap = { pendingCaption: null, pendingFigures: [], lastTable: null };
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          if (n.name === "w:tbl") {
            var tblInfo = { rows: 0, cols: 0, captionLabel: "", captionTitle: "", captionRich: "", captionLabelRich: "", captionNote: "", captionNoteRich: "" };
            processTable(n, tblInfo);
            if (cap.pendingCaption) {
              tblInfo.captionLabel = cap.pendingCaption.label;
              tblInfo.captionLabelRich = cap.pendingCaption.labelRich || cap.pendingCaption.label;
              tblInfo.captionTitle = cap.pendingCaption.title;
              tblInfo.captionRich = cap.pendingCaption.titleRich || cap.pendingCaption.title;
              tblInfo.captionNote = cap.pendingCaption.note || "";
              tblInfo.captionNoteRich = cap.pendingCaption.noteRich || "";
              cap.pendingCaption = null;
            }
            out.body.tables.push(tblInfo);
            cap.lastTable = tblInfo;
            continue;
          }
          if (n.name !== "w:p") continue;
          processParagraph(n, null, out, styleUsage, styleNameMap, cap, styleOrder);
        }
      }

      // ---- Populate the style inventory (in XML document order: at, au, af,
      // abstract, keyword, sections, bullets, tables, refs, back matter ...) ----
      var inv = [];
      var orderList = styleOrder.length ? styleOrder : Object.keys(styleUsage);
      for (var oi = 0; oi < orderList.length; oi++) {
        var sk2 = orderList[oi];
        if (!styleUsage[sk2]) continue;
        inv.push({ id: sk2, label: labelForStyle(sk2, styleNameMap), count: styleUsage[sk2],
          isHeading: headingLevelOf(sk2) > 0 });
      }
      out.styles.inventory = inv;

      // ---- Section tree (headings) exposed on the body for the overview ----
      out.body.headings = (out.raw.headingParas || []).map(function (h) {
        return { level: h.level, title: h.title, style: h.style };
      });

      // Drop internal bookkeeping fields from figure objects.
      (out.body.figures || []).forEach(function (g) {
        delete g._awaiting; delete g._captionOpen;
      });

      // ---- Style warnings ----
      buildStyleWarnings(styleUsage, styleNameMap, out);

      // ---- media count (images incl. equation preview metafiles) ----
      out.body.imageFiles = imgs.length;

      // ---- count equations by scanning XML text (siblings count) ----
      if (docXml) {
        out.body.equations.native = (docXml.match(/<m:oMath(?:\s|>)/g) || []).length;
        // MathType/Equation Editor OLE: <w:object> with ProgID="Equation.DSMT4"
        var oleCount = 0;
        var oleRe = /<o:OLEObject[^>]*ProgID="([^"]+)"/g, om;
        while ((om = oleRe.exec(docXml)) !== null) {
          if (/Equation|MathType/i.test(om[1])) oleCount++;
        }
        out.body.equations.mathtype = oleCount;
      }

      // ---- footnotes / endnotes (real ones only, skip separators) ----
      out.body.footnotes = countNotes(footXml, "w:footnote");
      out.body.endnotes = countNotes(endXml, "w:endnote");

      return out;
    });
  }

  function countNotes(xml, tag) {
    if (!xml) return 0;
    var n = 0, re = new RegExp("<" + tag + "\\b[^>]*w:id=\"([^\"]+)\"[^>]*>", "g"), m;
    while ((m = re.exec(xml)) !== null) {
      var id = parseInt(m[1], 10);
      if (id >= 0) n++;
    }
    return n;
  }

  function intOf(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  function nodeTextChild(node, name) {
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) if (kids[i].name === name) return kids[i].text || "";
    return "";
  }

  function textOfNamedChild(children, name, attr) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c.name === name) return attr ? (c.attrs[attr] != null ? c.attrs[attr] : (c.text || "")) : (c.text || "");
    }
    return "";
  }

  function findFirstByName(node, name) {
    var found = null;
    walk(node, function (n) { if (!found && n.name === name) found = n; });
    return found;
  }

  function headingLevelOf(styleId) {
    if (!styleId) return 0;
    if (/^H[1-6]$/.test(styleId)) return parseInt(styleId[1], 10);
    if (styleId === "EH") return 2; // end-matter heading treated as level 2-ish
    if (styleId === "appendixmain") return 1;
    if (styleId === "appendixsec1") return 2;
    if (styleId === "appendixsec2") return 3;
    return 0;
  }

  function labelForStyle(styleId, nameMap) {
    if (!styleId) return "Normal";
    var mapped = STYLE_LABELS[styleId];
    if (mapped) return mapped;
    var nm = nameMap[styleId];
    return nm && nm !== styleId ? (nm.charAt(0).toUpperCase() + nm.slice(1)) : styleId;
  }

  function processParagraph(pNode, ctx, out, styleUsage, nameMap, cap, styleOrder) {
    var pPr = findFirstByName(pNode, "w:pPr");
    var styleId = "";
    if (pPr) {
      var ps = findChildren(pPr, "w:pStyle");
      if (ps.length) styleId = ps[0].attrs["w:val"] || "";
    }
    if (styleId) {
      styleUsage[styleId] = (styleUsage[styleId] || 0) + 1;
      if (styleOrder && styleOrder.indexOf(styleId) === -1) styleOrder.push(styleId);
    }

    var text = nodeText(pNode);
    var rich = nodeHtml(pNode);
    var hasMath = !!findFirstByName(pNode, "m:oMath");
    var hasOle = false;
    walk(pNode, function (n) {
      if (!hasOle && n.name === "w:object") hasOle = true;
    });

    var isHeading = headingLevelOf(styleId) > 0;

    // ---- Front matter capture by style ----
    if (styleId === "AT" || styleId === "AS") {
      if (styleId === "AT") { out.front.title = (out.front.title || "") + forceSpace(out.front.title, text); out.front.titleRich = (out.front.titleRich || "") + forceSpace(out.front.titleRich, rich); }
      else { out.front.subtitle = (out.front.subtitle || "") + forceSpace(out.front.subtitle, text); out.front.subtitleRich = (out.front.subtitleRich || "") + forceSpace(out.front.subtitleRich, rich); }
    } else if (styleId === "DOI0" && /10\.\d{4,9}\//i.test(text)) {
      var dm = /\b10\.\d{4,9}\/[^\s]+/i.exec(text);
      if (dm) out.front.doi = dm[0].replace(/[.,;)\]]+$/, "");
    } else if (styleId === "TY0" && text) {
      out.front.articleType = (out.front.articleType || "") + forceSpace(out.front.articleType, text);
    } else if (styleId === "LRH0") {
      out.front.runningHeadL = (out.front.runningHeadL || "") + forceSpace(out.front.runningHeadL, text);
    } else if (styleId === "RRH0") {
      out.front.runningHeadR = (out.front.runningHeadR || "") + forceSpace(out.front.runningHeadR, text);
    } else if (styleId === "AU0" && text) {
      out.front.authors.push(text.replace(/\[INSERT[^\]]*\]/gi, "").trim());
    } else if (styleId === "AF" && text && text !== "Corresponding Author:") {
      out.front.affiliations.push(text.trim());
      out.front.affiliationsRich.push(rich || text.trim());
    } else if (styleId === "ABKW" && text) {
      out.front.abstract.paragraphs.push(text.trim());
      out.front.abstract.paragraphsRich.push(rich || text.trim());
      // Keywords live on their own ABKW paragraph right after the ABKWH heading
    } else if (styleId === "ABKWH") {
      out.front.keywordsHeading = text.trim();
    } else if (styleId === "DR" && text) {
      var dm2 = /received:\s*([^;]*?);\s*accepted:\s*([^;]*)/i.exec(text);
      if (dm2) { out.front.datesReceived = dm2[1].trim(); out.front.datesAccepted = dm2[2].trim(); }
    }

    // ---- Abstract struct (Background/Methods/Results/Conclusions) ----
    if (styleId === "ABKW") {
      var seg = /^\s*(Background|Methods|Results|Conclusions?)\b\.?/i.exec(text);
      if (seg) {
        out.front.abstract.hasStructured = true;
        out.front.abstract.sections = out.front.abstract.sections || {};
        out.front.abstract.sections[seg[1].toLowerCase()] = (out.front.abstract.sections[seg[1].toLowerCase()] || "") + " " + text.slice(seg[0].length).trim();
        out.front.abstract.sectionsRich = out.front.abstract.sectionsRich || {};
        // split the rich string at the identical label offset to keep <b> labels
        var labelLen = /^\s*(Background|Methods|Results|Conclusions?)\b\.?/i.exec(rich);
        out.front.abstract.sectionsRich[seg[1].toLowerCase()] =
          (out.front.abstract.sectionsRich[seg[1].toLowerCase()] || "") + " " +
          (labelLen ? rich.slice(labelLen[0].length) : rich);
      }
    }

    // ---- Keywords: first ABKW after ABKWH heading ----
    if (styleId === "ABKW" && !out.front.keywordsSet && text && !/^(Background|Methods|Results|Conclusions?)\b/i.test(text)) {
      out.front.keywordsSet = true;
      out.front.keywords = text.split(",").map(function (k) { return k.trim(); }).filter(Boolean);
    }

    // ---- Back matter headings & refs ----
    if (styleId === "EH") {
      // Scan all AH/EH end-matter headings and file them by category so the
      // overview dropdown can show funding / appendix / disclosure, etc.
      var eh = text.trim();
      out.back.headings = out.back.headings || [];
      out.back.headings.push(eh);
      if (/reference/i.test(eh)) out.back.referencesHeading = eh;
      else if (/^appendix/i.test(eh)) { out.back.appendix = out.back.appendix || []; out.back.appendix.push({ heading: eh, items: [], itemsRich: [] }); }
      else if (/acknowledg/i.test(eh)) out.back.acknowledgements = { heading: eh, items: [], itemsRich: [] };
      else if (/funding|support|financial/i.test(eh)) { out.back.funding = { heading: eh, items: [], itemsRich: [] }; }
      else if (/conflict|disclos/i.test(eh)) { out.back.disclosure = { heading: eh, items: [], itemsRich: [] }; }
      else if (/data availability/i.test(eh)) { out.back.dataAvailability = { heading: eh, items: [], itemsRich: [] }; }
      else if (/ethical|approval|consent|permission/i.test(eh)) { out.back.ethics = out.back.ethics || []; out.back.ethics.push({ heading: eh, items: [], itemsRich: [] }); }
      else if (/orcid/i.test(eh)) { out.back.orcid = { heading: eh, items: [], itemsRich: [] }; }
      else if (/corresponding/i.test(eh)) { out.back.corresponding = { heading: eh, items: [], itemsRich: [] }; }
    } else if (styleId === "REF" && text) {
      out.back.references.push({ num: out.back.references.length + 1, text: text, rich: rich || text });
    }
    // Attach following AN (author-note) paragraph content to the most recent
    // end-matter category.
    else if (styleId === "AN" && text) {
      var backItem = lastBackItem(out.back);
      if (backItem) backItem.items.push(text.trim());
      if (backItem && backItem.itemsRich) backItem.itemsRich.push(rich || text.trim());
    }

    // ---- Section tree from headings ----
    if (isHeading && text && styleId !== "EH") {
      var lvl = headingLevelOf(styleId);
      var parsedHeading = { level: lvl, title: text, style: styleId };
      if (!out.raw.headingParas) out.raw.headingParas = [];
      out.raw.headingParas.push(parsedHeading);
    }

    // ---- Caption + figure handling ----
    // captions use the same styles for tables and figures (CPB label, CP title,
    // CPSO note). The most recently created "*pointer" figure (from a
    // "[Figure N ABOUT HERE]" insertion marker) may be awaiting its following
    // caption chain, so feed CPB/CP/CPSO into it instead of the next table.
    var openFig = null;
    if (cap.pendingFigures && cap.pendingFigures.length) {
      openFig = cap.pendingFigures[cap.pendingFigures.length - 1];
    }
    var isCaptionPara = styleId === "CPB" || styleId === "CP" || styleId === "EPA" || styleId === "CPSO";
    if (isCaptionPara) {
      if (styleId === "CPB" || styleId === "EPA") {
        // A fresh label: if the open pointer-figure is still experimentally
        // open (was feeding its own caption), bump it into serialized form by
        // dropping the bookkeeping flags. It's only the figure's own label if
        // the figure is still "awaiting" its first caption.
        if (openFig && openFig._awaiting) {
          openFig.caption = text;
          openFig.captionRich = rich || text;
          openFig._awaiting = false;
          openFig._captionOpen = true;
        } else {
          // This label belongs to a different entity. Finalize any still-open
          // figure chain and treat this as a table/figure caption.
          if (openFig) openFig._captionOpen = false;
          cap.pendingCaption = { label: text, labelRich: rich || text, title: "", titleRich: "", note: "", noteRich: "" };
        }
      } else if (openFig && openFig._captionOpen) {
        // Continue the pointer-figure's caption chain (title / note).
        if (styleId === "CP" || styleId === "EPA") {
          if (openFig.caption && openFig.caption.indexOf(text) === -1) { openFig.caption += " " + text; }
          else if (!openFig.caption) { openFig.caption = text; }
          if (openFig.captionRich && openFig.captionRich.indexOf(">" + text) === -1) { openFig.captionRich += " " + (rich || text); }
          else if (!openFig.captionRich) { openFig.captionRich = rich || text; }
        } else if (styleId === "CPSO") {
          openFig.note = (openFig.note || "") + (openFig.note ? " " : "") + text;
          openFig.noteRich = (openFig.noteRich || "") + (openFig.noteRich ? " " : "") + (rich || text);
        }
      } else if (styleId === "CPSO" && cap.lastTable && !cap.pendingCaption) {
        // Table note that arrives AFTER the <w:tbl>: attach to the last table.
        cap.lastTable.captionNote = (cap.lastTable.captionNote || "") + (cap.lastTable.captionNote ? " " : "") + text;
        cap.lastTable.captionNoteRich = (cap.lastTable.captionNoteRich || "") + (cap.lastTable.captionNoteRich ? " " : "") + (rich || text);
      } else {
        // Table caption — stage for the next <w:tbl>.
        if (styleId === "CP") {
          cap.pendingCaption = { label: cap.pendingCaption ? cap.pendingCaption.label : "", labelRich: cap.pendingCaption ? cap.pendingCaption.labelRich : "", title: text, titleRich: rich || text, note: cap.pendingCaption ? cap.pendingCaption.note : "", noteRich: cap.pendingCaption ? cap.pendingCaption.noteRich : "" };
        } else { // CPSO
          cap.pendingCaption = { label: cap.pendingCaption ? cap.pendingCaption.label : "", labelRich: cap.pendingCaption ? cap.pendingCaption.labelRich : "", title: cap.pendingCaption ? cap.pendingCaption.title : "", titleRich: cap.pendingCaption ? cap.pendingCaption.titleRich : "", note: (cap.pendingCaption ? cap.pendingCaption.note : "") + (cap.pendingCaption && cap.pendingCaption.note ? " " : "") + text, noteRich: (cap.pendingCaption ? cap.pendingCaption.noteRich : "") + (cap.pendingCaption && cap.pendingCaption.noteRich ? " " : "") + (rich || text) };
        }
      }
    }

    // ---- Figure detection: "[Figure N ABOUT HERE]" insertion placeholders
    // (caption follows), and floating/inline drawings (caption precedes, held
    // in pendingCaption). OLE-equation previews (w:object v:imagedata) are not
    // figures. ----
    var hasInline = !!findFirstByName(pNode, "wp:inline");
    var hasAnchor = !!findFirstByName(pNode, "wp:anchor");
    var aboutHere = /^\s*\[?\s*(?:FIGURE\s+)?(\d+)\s*ABOUT HERE/i.test(text);
    if (aboutHere) {
      var figObj = { type: "pointer", pointer: text.trim(), caption: "", captionRich: "", note: "", noteRich: "", _awaiting: true, _captionOpen: false };
      out.body.figures.push(figObj);
      if (!cap.pendingFigures) cap.pendingFigures = [];
      cap.pendingFigures.push(figObj);
      cap.pendingCaption = null;
    } else if (hasInline || hasAnchor) {
      // An image after its caption: if a pointer is awaiting, this IS its
      // location — attach whatever caption/pendingCaption is available.
      if (openFig && openFig._awaiting) { openFig._awaiting = false; }
      var capItem = cap.pendingCaption;
      if (cap.pendingFigures && cap.pendingFigures.length) {
        var pendingImg = cap.pendingFigures[cap.pendingFigures.length - 1];
        if (!pendingImg.caption && capItem) pendingImg.caption = capItem.label + (capItem.title ? " " + capItem.title : "");
        if (!pendingImg.captionRich && capItem) pendingImg.captionRich = capItem.labelRich + (capItem.titleRich ? " " + capItem.titleRich : "");
        if (!pendingImg.note && capItem && capItem.note) pendingImg.note = capItem.note;
        if (!pendingImg.noteRich && capItem && capItem.noteRich) pendingImg.noteRich = capItem.noteRich;
      } else {
        out.body.figures.push({ type: hasInline ? "inline" : "anchor",
          caption: capItem ? (capItem.label + (capItem.title ? " " + capItem.title : "")) : "",
          captionRich: capItem ? (capItem.labelRich + (capItem.titleRich ? " " + capItem.titleRich : "")) : "",
          note: capItem && capItem.note ? capItem.note : "",
          noteRich: capItem && capItem.noteRich ? capItem.noteRich : "" });
      }
      cap.pendingCaption = null;
    }
  }

  function forceSpace(existing, add) {
    if (!existing) return add;
    return " " + add;
  }

  // Find the most recently opened and still-"open" back-matter group that
  // accepts .items (funding, disclosure, appendix, ethics, ORCID, etc.), so an
  // AN (author-note) paragraph can be attached under the right heading.
  function lastBackItem(back) {
    var last = null, i;
    var cands = [
      back.acknowledgements, back.funding, back.disclosure, back.dataAvailability,
      back.orcid, back.corresponding,
      back.appendix && back.appendix[back.appendix.length - 1],
      back.ethics && back.ethics[back.ethics.length - 1]
    ];
    if (back.headings && back.headings.length) {
      var H = back.headings;
      for (i = H.length - 1; i >= 0; i--) {
        var h = H[i];
        if (/^appendix/i.test(h)) return back.appendix && back.appendix[back.appendix.length - 1];
        if (/funding|support|financial/i.test(h)) return back.funding;
        if (/conflict|disclos/i.test(h)) return back.disclosure;
        if (/data availability/i.test(h)) return back.dataAvailability;
        if (/orcid/i.test(h)) return back.orcid;
        if (/corresponding/i.test(h)) return back.corresponding;
        if (/ethical|consent|approval/i.test(h)) return back.ethics && back.ethics[back.ethics.length - 1];
        if (/acknowledg/i.test(h)) return back.acknowledgements;
      }
    }
    for (i = 0; i < cands.length; i++) if (cands[i] && cands[i].items) last = cands[i];
    return last;
  }

  function processTable(tblNode, tblInfo) {
    // Count rows (w:tr) and columns (w:gridCol in w:tblGrid, fall back to the
    // widest row's cells).
    var rows = findChildren(tblNode, "w:tr").length;
    var cols = 0;
    var grid = findFirstByName(tblNode, "w:tblGrid");
    if (grid) cols = findChildren(grid, "w:gridCol").length;
    if (!cols) {
      for (var i = 0; i < tblNode.children.length; i++) {
        if (tblNode.children[i].name === "w:tr") {
          cols = Math.max(cols, findChildren(tblNode.children[i], "w:tc").length);
        }
      }
    }
    tblInfo.rows = rows;
    tblInfo.cols = cols;
  }

  function buildStyleWarnings(styleUsage, nameMap, out) {
    var list = [];
    var usages = Object.keys(styleUsage || {});
    // Heading style used only once (suspicious) or body styles inconsistency
    for (var k in styleUsage) {
      var lvl = headingLevelOf(k);
      if (lvl > 0 && styleUsage[k] === 1) {
        list.push("Heading style \"" + labelForStyle(k, nameMap) + " (" + k + ")\" used only once — check for an accidental drop or a one-off heading.");
      }
    }
    // A common style-lint heuristic: a single paragraph uses a heading style
    // but its text is empty (an orphan heading).
    out.styles.warnings = list;
  }

  return { parse: parseDocxMeta, parseXmlTree: parseXmlTree };
}));
