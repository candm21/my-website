// docx_crossref core logic - JS port for in-browser use (no server needed)

function escapeHtml(str) {
  const div = { textContent: str };
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function cleanHtmlToPureText(fragment) {
  let txt = fragment.replace(/<[^>]+>/g, " ");
  // basic entity unescape
  const ta = (typeof document !== "undefined") ? document.createElement("textarea") : null;
  if (ta) {
    ta.innerHTML = txt;
    txt = ta.value;
  } else {
    txt = txt.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ");
  }
  txt = txt.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  txt = txt.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
  txt = txt.replace(/\s+/g, " ");
  return txt.trim();
}

const NON_REFERENCE_PATTERNS = [
  /author\s+bio/i, /biography/i, /appendix/i, /interview\s+questions/i,
  /teaching\s+experience/i, /educational\s+background/i,
  /corresponding\s+author/i, /assistant\s+professor/i,
  /ph\.d\.\s+is\s+a/i, /lecturer\s+at/i,
];

function isNonReferenceSection(text) {
  return NON_REFERENCE_PATTERNS.some((p) => p.test(text));
}

const REFERENCES_HEADING_RE = /<(p|h[1-6])[^>]*>\s*(?:<strong>\s*)?References?\s*(?:<\/strong>\s*)?<\/\1>/i;

function splitBodyAndReferences(htmlContent) {
  const m = REFERENCES_HEADING_RE.exec(htmlContent);
  if (m) {
    return [htmlContent.slice(0, m.index), htmlContent.slice(m.index + m[0].length), m[0]];
  }
  const m2 = /References?\b/i.exec(htmlContent);
  if (m2) {
    return [htmlContent.slice(0, m2.index), htmlContent.slice(m2.index + m2[0].length), "<p><strong>References</strong></p>"];
  }
  return [htmlContent, "", "<p><strong>References</strong></p>"];
}

function parseBibEntries(bibContent) {
  const entries = [];
  const paraRe = /<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/g;
  let m, idx = 0;
  while ((m = paraRe.exec(bibContent)) !== null) {
    idx++;
    const entry = m[1];
    const cleanText = cleanHtmlToPureText(entry);
    if (!cleanText || cleanText.length < 10) continue;
    if (isNonReferenceSection(cleanText)) continue;

    const idMatch = /id="([^"]+)"/.exec(entry);
    const spanId = idMatch ? idMatch[1] : `ref${idx}`;

    const yearMatch = /\b(19\d{2}|20\d{2})[a-z]?\b/.exec(cleanText);
    const yearStr = yearMatch ? yearMatch[0] : "";

    let firstPart = cleanText.split("(")[0].trim();
    firstPart = firstPart.replace(/^\[?\d+\]?\.?\s*/, "");

    const surnames = [];
    const surnameAliases = [];
    const authorChunks = firstPart.split(/,|\band\b|&/);
    for (const chunk of authorChunks) {
      const words = chunk.trim().split(/\s+/).filter(Boolean);
      const run = [];
      for (const word of words) {
        const lw = word.toLowerCase();
        if (["and", "et", "al", "al.", "in", "the", "of", "&"].includes(lw)) {
          if (run.length) break;
          continue;
        }
        const candidate = word.replace(/[^A-Za-zÀ-ÿ'\-]/g, "");
        const isBareInitials = /^[A-Z]{1,3}(-[A-Z]{1,3})?$/.test(candidate || "");
        if (isBareInitials && run.length) break;
        if (candidate && /^[A-ZÀ-Ý]/.test(candidate) && candidate.length > 1 && !isBareInitials) {
          run.push(candidate);
        } else if (run.length) {
          break;
        }
      }
      if (run.length) {
        const full = run.join(" ");
        surnames.push(full);
        surnameAliases.push(full);
        if (run.length > 1) surnameAliases.push(...run);
      }
    }

    const dedupe = (arr) => [...new Set(arr)];
    const uSurnames = dedupe(surnames);
    const uAliases = dedupe(surnameAliases);
    const surname = uSurnames[0] || "";

    if (!surname || !yearStr) continue;

    entries.push({
      id: spanId,
      cleanText,
      surname,
      surnames: uSurnames,
      surnameAliases: uAliases,
      year: yearStr,
      displayName: `${firstPart.slice(0, 40)} (${yearStr})`,
    });
  }
  return entries;
}

function findDuplicates(entries) {
  const seen = {};
  const dupIds = new Set();
  for (const e of entries) {
    const key = `${e.surname.toLowerCase()}_${e.year}`;
    if (seen[key]) {
      dupIds.add(e.id);
      dupIds.add(seen[key]);
    } else {
      seen[key] = e.id;
    }
  }
  return dupIds;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPatterns(surname, year) {
  const s = escRe(surname), y = escRe(year);
  return [
    { re: new RegExp(`\\b${s}\\b[^A-Za-z0-9]{0,15}\\(?${y}\\)?`, "i"), loose: false },
    { re: new RegExp(`\\(?${y}\\)?[^A-Za-z0-9]{0,15}\\b${s}\\b`, "i"), loose: false },
    { re: new RegExp(`\\b${s}\\b(?:\\W+\\w+){0,5}?\\W*\\(?${y}\\)?`, "i"), loose: true },
    { re: new RegExp(`\\(?${y}\\)?(?:\\W+\\w+){0,5}?\\W*\\b${s}\\b`, "i"), loose: true },
  ];
}

function highlightMatch(snippet, surname, year) {
  let out = snippet.replace(new RegExp(`\\b${escRe(surname)}\\b`, "gi"), (mm) => `<mark style="background:#fef08a;">${mm}</mark>`);
  out = out.replace(new RegExp(`\\b${escRe(year)}\\b`, "g"), (mm) => `<mark style="background:#bbf7d0;">${mm}</mark>`);
  return out;
}

function findOrphanCitations(bodyContent, entries) {
  const cleanBody = cleanHtmlToPureText(bodyContent);
  const knownPairs = new Set();
  for (const e of entries) {
    const aliases = e.surnameAliases && e.surnameAliases.length ? e.surnameAliases : e.surnames;
    for (const s of aliases) knownPairs.add(`${s.toLowerCase()}_${e.year}`);
  }

  const citationRe = /\b([A-Z][A-Za-z'\-]+)(?:\s*(?:&|and)\s*([A-Z][A-Za-z'\-]+))?[,\s]*\(?\s*((?:19|20)\d{2}[a-z]?)\s*\)?/g;
  const orphans = {};
  let m;
  while ((m = citationRe.exec(cleanBody)) !== null) {
    const sur1 = m[1], sur2 = m[2], year = m[3];
    const yearClean = year.replace(/[a-z]$/, "");
    const candidates = [sur1, sur2].filter(Boolean);
    if (!candidates.length) continue;
    if (candidates.some((s) => knownPairs.has(`${s.toLowerCase()}_${yearClean}`))) continue;
    const falsePositiveWords = [
      "table", "figure", "see", "chapter", "section", "equation", "note",
      "january", "february", "march", "april", "may", "june", "july",
      "august", "september", "october", "november", "december",
    ];
    if (falsePositiveWords.includes(sur1.toLowerCase())) continue;

    const tail = cleanBody.slice(m.index + m[0].length, m.index + m[0].length + 6);
    if (/^-\d/.test(tail)) continue;

    const key = `${sur1}|${sur2 || ""}|${yearClean}`;
    if (!orphans[key]) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(cleanBody.length, m.index + m[0].length + 40);
      orphans[key] = {
        sur1, sur2: sur2 || "", year: yearClean,
        context: cleanBody.slice(start, end).trim(),
        count: 0,
      };
    }
    orphans[key].count++;
  }
  return orphans;
}

function linkAndReport(bodyContent, entries, dupIds) {
  const cleanBody = cleanHtmlToPureText(bodyContent);
  let linkedBody = bodyContent;
  const linkedEntries = [], unlinkedEntries = [];

  for (const e of entries) {
    const year = e.year, spanId = e.id;
    const surnames = e.surnames && e.surnames.length ? e.surnames : [e.surname];

    let matchSurname = null, matchMethod = null, found = null;
    for (const surname of surnames) {
      const patterns = buildPatterns(surname, year);
      for (const p of patterns) {
        const mm = p.re.exec(cleanBody);
        if (mm) {
          found = mm;
          matchSurname = surname;
          matchMethod = p.loose ? "loose" : "tight";
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      const contexts = [];
      const seenPlain = new Set();
      const allPatterns = buildPatterns(matchSurname, year);
      outer:
      for (const p of allPatterns) {
        const re2 = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
        let mm2;
        while ((mm2 = re2.exec(cleanBody)) !== null) {
          const start = Math.max(0, mm2.index - 35);
          const end = Math.min(cleanBody.length, mm2.index + mm2[0].length + 35);
          const snippet = cleanBody.slice(start, end).trim();
          if (seenPlain.has(snippet)) continue;
          seenPlain.add(snippet);
          contexts.push({ plain: snippet, html: highlightMatch(snippet, matchSurname, year) });
          if (contexts.length >= 3) break outer;
        }
      }

      const htmlPattern = new RegExp(`${escRe(matchSurname)}(?:[^<]{0,60})${escRe(year)}`, "i");
      const mLink = htmlPattern.exec(linkedBody);
      if (mLink && !mLink[0].includes("href=") && !mLink[0].includes("</a>")) {
        linkedBody = linkedBody.slice(0, mLink.index) +
          `<a href="#${spanId}" style="color:#2563eb;text-decoration:underline;">${mLink[0]}</a>` +
          linkedBody.slice(mLink.index + mLink[0].length);
      }

      linkedEntries.push({
        id: spanId, displayName: e.displayName, contexts,
        isDuplicate: dupIds.has(spanId), matchMethod, matchedSurname: matchSurname,
      });
    } else {
      let reason = "No occurrence of author surname found in text";
      let anySurnameFound = false;
      for (const surname of surnames) {
        if (new RegExp(`\\b${escRe(surname)}\\b`, "i").test(cleanBody)) {
          anySurnameFound = true;
          const widePattern = new RegExp(
            `\\b${escRe(surname)}\\b[\\s\\S]{0,150}\\b${escRe(year)}\\b|\\b${escRe(year)}\\b[\\s\\S]{0,150}\\b${escRe(surname)}\\b`, "i"
          );
          if (widePattern.test(cleanBody)) {
            reason = `'${surname}' and '${year}' both found, but far apart / unusual punctuation or word-gap between them (formatting mismatch)`;
          } else {
            reason = `'${surname}' found in text, but year '${year}' not nearby anywhere (possible year typo or no in-text citation)`;
          }
          break;
        }
      }
      if (!anySurnameFound) reason = "Author surname does not appear anywhere in the body text (likely never cited)";

      unlinkedEntries.push({
        id: spanId, displayName: e.displayName, cleanText: e.cleanText,
        isDuplicate: dupIds.has(spanId), reason,
      });
    }
  }

  return { linkedBody, linkedEntries, unlinkedEntries };
}

function buildReportHtml(total, linkedEntries, unlinkedEntries, dupIds, orphans) {
  const dupBadge = (isDup) => isDup
    ? ' <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;">Duplicate</span>'
    : '';
  const methodBadge = (method) => method === "loose"
    ? ' <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;">loose match</span>'
    : '';

  const linkedRows = linkedEntries.map((e) => `
        <tr class="linked-row">
            <td>${escapeHtml(e.id)}${dupBadge(e.isDuplicate)}</td>
            <td><strong>${escapeHtml(e.displayName)}</strong>${methodBadge(e.matchMethod)}</td>
            <td>${e.contexts.map((c) => c.html).join("<br>") || "-"}</td>
        </tr>`).join("") || `
        <tr><td colspan="3" style="text-align:center;color:#64748b;padding:20px;">No linked citations found.</td></tr>`;

  const unlinkedRows = unlinkedEntries.map((e) => `
        <tr class="unlinked-row">
            <td>${escapeHtml(e.id)}${dupBadge(e.isDuplicate)}</td>
            <td><strong>${escapeHtml(e.displayName)}</strong></td>
            <td>${escapeHtml(e.cleanText.slice(0, 150))}${e.cleanText.length > 150 ? "..." : ""}</td>
            <td class="reason-cell">${escapeHtml(e.reason || "")}</td>
        </tr>`).join("") || `
        <tr><td colspan="4" style="text-align:center;color:#27ae60;padding:20px;">All references were linked.</td></tr>`;

  const orphanKeys = Object.keys(orphans);
  const orphanRows = orphanKeys.map((k) => {
    const d = orphans[k];
    return `
        <tr class="orphan-row">
            <td><strong>${escapeHtml(d.sur1)}${d.sur2 ? " &amp; " + escapeHtml(d.sur2) : ""} (${escapeHtml(d.year)})</strong></td>
            <td>${escapeHtml(d.context)}</td>
            <td style="text-align:center;">${d.count}</td>
            <td style="text-align:center;color:#9a3412;font-style:italic;">Unnumbered</td>
        </tr>`;
  }).join("") || `
        <tr><td colspan="4" style="text-align:center;color:#27ae60;padding:20px;">No orphan citations found - every in-text citation has a matching reference entry.</td></tr>`;

  const linkedCount = linkedEntries.length;
  const unlinkedCount = unlinkedEntries.length;
  const dupCount = dupIds.size;
  const orphanCount = orphanKeys.length;
  const pct = total ? Math.round((linkedCount / total) * 1000) / 10 : 0;
  const looseCount = linkedEntries.filter((e) => e.matchMethod === "loose").length;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reference Cross-Link Report</title>
<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:30px;background:#f8fafc;color:#1a202c;}
.container{max-width:1300px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h1{color:#0f172a;border-bottom:3px solid #3498db;padding-bottom:15px;}
.stats{display:flex;gap:15px;margin:25px 0;flex-wrap:wrap;}
.stat{flex:1;min-width:150px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;text-align:center;}
.stat .num{font-size:28px;font-weight:700;}
table{width:100%;border-collapse:collapse;margin:15px 0 35px;}
th{background:#0f172a;color:#fff;padding:12px;text-align:left;font-size:13px;}
td{padding:10px;border:1px solid #e2e8f0;font-size:13px;vertical-align:top;}
.linked-row{background:#f0fdf4;}
.unlinked-row{background:#fef2f2;}
.orphan-row{background:#fff7ed;}
.reason-cell{color:#92400e;font-style:italic;}
mark{padding:1px 2px;border-radius:3px;}
</style></head>
<body><div class="container">
<h1>Reference Cross-Link Audit Report</h1>
<div class="stats">
  <div class="stat"><div class="num">${total}</div>Total References</div>
  <div class="stat"><div class="num" style="color:#16a34a;">${linkedCount}</div>Linked (${pct}%)</div>
  <div class="stat"><div class="num" style="color:#1d4ed8;">${looseCount}</div>Loose Matches</div>
  <div class="stat"><div class="num" style="color:#dc2626;">${unlinkedCount}</div>Unlinked</div>
  <div class="stat"><div class="num" style="color:#d97706;">${dupCount}</div>Duplicate Entries</div>
  <div class="stat"><div class="num" style="color:#ea580c;">${orphanCount}</div>Orphan In-Text Citations</div>
</div>
<h2>Linked Citations (${linkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"loose match" = surname and year found with extra words between them rather than directly adjacent. Matched <mark style="background:#fef08a;">surname</mark> and <mark style="background:#bbf7d0;">year</mark> are highlighted.</p>
<table><thead><tr><th>Bib ID</th><th>Reference</th><th>Context Found</th></tr></thead>
<tbody>${linkedRows}</tbody></table>
<h2>Unlinked Citations (${unlinkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"Reason" diagnoses why no match was made.</p>
<table><thead><tr><th>Bib ID</th><th>Reference</th><th>Reference Text</th><th>Reason</th></tr></thead>
<tbody>${unlinkedRows}</tbody></table>
<h2>Orphan In-Text Citations (${orphanCount})</h2>
<p style="color:#64748b;font-size:13px;">Citations in the body text with NO matching reference entry - need a reference added, or are a typo.</p>
<table><thead><tr><th>Citation</th><th>Context</th><th>Occurrences</th><th>Ref No</th></tr></thead>
<tbody>${orphanRows}</tbody></table>
</div></body></html>`;
}

function generateReport(htmlContent) {
  const [bodyContent, bibContent] = splitBodyAndReferences(htmlContent);
  const entries = parseBibEntries(bibContent);
  const dupIds = findDuplicates(entries);
  const { linkedEntries, unlinkedEntries } = linkAndReport(bodyContent, entries, dupIds);
  const orphans = findOrphanCitations(bodyContent, entries);
  return buildReportHtml(entries.length, linkedEntries, unlinkedEntries, dupIds, orphans);
}

