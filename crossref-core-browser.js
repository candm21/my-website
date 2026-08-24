// docx_crossref core logic - JS port for in-browser use (no server needed)

function escapeHtml(str) {
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
  // Normalize to NFC so accented characters (e.g. combining-mark vs
  // precomposed forms of č/ć/ö/etc.) compare equal wherever they appear.
  if (typeof txt.normalize === "function") txt = txt.normalize("NFC");
  return txt.trim();
}

// Strip a trailing possessive ('s / 's / ’s or a bare trailing apostrophe)
// so "Luker's (2008)" is compared as "Luker" against the reference list.
function stripPossessive(s) {
  return String(s).replace(/['\u2019]s$/i, "").replace(/['\u2019]$/, "");
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

// Accept the common heading variants people actually use, not just
// "References" - Bibliography / Works Cited / Reference List all mark the
// same section in different citation styles.
const REFERENCES_HEADING_RE = /<(p|h[1-6])[^>]*>\s*(?:<strong>\s*)?(References?|Bibliography|Works\s+Cited|Reference\s+List)\s*(?:<\/strong>\s*)?<\/\1>/i;

function splitBodyAndReferences(htmlContent) {
  const m = REFERENCES_HEADING_RE.exec(htmlContent);
  if (m) {
    return [htmlContent.slice(0, m.index), htmlContent.slice(m.index + m[0].length), m[0]];
  }
  const m2 = /References?|Bibliography|Works\s+Cited|Reference\s+List/i.exec(htmlContent);
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

    // Take everything before the entry's year, not just before the first
    // "(" - a reference like "United Nations Development Programme (UNDP).
    // (2021)." has an abbreviation in its own parens *before* the year's
    // parens, and splitting on the first "(" was silently discarding it.
    let firstPart;
    if (yearMatch) {
      firstPart = cleanText.slice(0, yearMatch.index).replace(/\(\s*$/, "").trim();
    } else {
      firstPart = cleanText.split("(")[0].trim();
    }
    firstPart = firstPart.replace(/^\[?\d+\]?\.?\s*/, "");
    firstPart = firstPart.replace(/[.,;:]\s*$/, "").trim();

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
        // \p{L} (any-language letter) instead of A-Za-zÀ-ÿ so names using
        // Latin Extended-A/B characters (č, ć, ř, etc.) survive intact.
        const candidate = word.replace(/[^\p{L}'\-]/gu, "");
        const isBareInitials = /^\p{Lu}{1,3}(-\p{Lu}{1,3})?$/u.test(candidate || "");
        if (isBareInitials && run.length) break;
        if (candidate && /^\p{Lu}/u.test(candidate) && candidate.length > 1 && !isBareInitials) {
          run.push(candidate);
        } else if (run.length) {
          break;
        }
      }
      if (run.length) {
        const full = run.join(" ");
        surnames.push(full);
        surnameAliases.push(full);
        if (run.length === 2) {
          // Almost always a compound personal surname (Kosterman Zoller,
          // Van Dijk, De Bruin) - alias each half so a citation using only
          // the first part still matches.
          surnameAliases.push(...run);
        } else if (run.length > 2) {
          // Likely a multi-word institutional/organization name. Don't
          // alias every generic word in it (e.g. "International", "Board")
          // - a common word coincidentally appearing elsewhere with the
          // same year would create a false match. Only alias genuine
          // embedded abbreviations (all-caps tokens like "UNDP").
          for (const w of run) {
            if (/^\p{Lu}{2,8}$/u.test(w)) surnameAliases.push(w);
          }
        }
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
      // Rough count of listed authors (one per comma/&/and-separated chunk
      // that yielded a name). Used to sanity-check "et al." citations -
      // a single- or two-author reference should never be matched by an
      // "X et al." in-text citation; that citation belongs to a different,
      // often-missing, reference.
      authorCount: surnames.length || 1,
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

// Custom "boundary" strings: JS's built-in \b only treats ASCII
// [A-Za-z0-9_] as word characters, so it silently fails around names
// containing non-ASCII letters (č, ć, ř, ...). These lookarounds use
// \p{L}/\p{N} instead, so they work for any-language surnames. Every
// regex built with these must use the "u" flag.
const UB = "(?<![\\p{L}\\p{N}])";
const UE = "(?![\\p{L}\\p{N}])";

function buildPatterns(surname, year) {
  const s = escRe(surname), y = escRe(year);
  return [
    { re: new RegExp(`${UB}${s}${UE}[^\\p{L}\\p{N}]{0,15}\\(?${y}${UE}`, "iu"), loose: false },
    { re: new RegExp(`\\(?${y}${UE}[^\\p{L}\\p{N}]{0,15}${UB}${s}${UE}`, "iu"), loose: false },
    { re: new RegExp(`${UB}${s}${UE}(?:[^\\p{L}\\p{N}]+[\\p{L}\\p{N}]+){0,5}?[^\\p{L}\\p{N}]*\\(?${y}${UE}`, "iu"), loose: true },
    { re: new RegExp(`\\(?${y}${UE}(?:[^\\p{L}\\p{N}]+[\\p{L}\\p{N}]+){0,5}?[^\\p{L}\\p{N}]*${UB}${s}${UE}`, "iu"), loose: true },
  ];
}

function highlightMatch(snippet, surname, year) {
  let out = snippet.replace(new RegExp(`${UB}${escRe(surname)}${UE}`, "giu"), (mm) => `<mark style="background:#fef08a;">${mm}</mark>`);
  out = out.replace(new RegExp(`\\b${escRe(year)}\\b`, "g"), (mm) => `<mark style="background:#bbf7d0;">${mm}</mark>`);
  return out;
}

function findOrphanCitations(bodyContent, entries) {
  const cleanBody = cleanHtmlToPureText(bodyContent);
  // Map "surname_year" -> list of authorCounts for every reference that
  // could plausibly be cited under that surname+year.
  const knownPairs = {};
  for (const e of entries) {
    const aliases = e.surnameAliases && e.surnameAliases.length ? e.surnameAliases : e.surnames;
    for (const s of aliases) {
      const key = `${stripPossessive(s).toLowerCase()}_${e.year}`;
      (knownPairs[key] || (knownPairs[key] = [])).push(e.authorCount || 1);
    }
  }

  // Unicode-aware surname group; optional "& Surname2" / "and Surname2" for
  // two-author citations, OR "et al." for 3+-author citations (the previous
  // version had no "et al." branch at all, so citations like "Mulholland
  // et al., 2016" or "Hodgkins et al., 2012" were never even detected).
  const citationRe = new RegExp(
    `${UB}(\\p{Lu}[\\p{L}'\\-]+)(?:\\s*(?:&|and)\\s*(\\p{Lu}[\\p{L}'\\-]+)|(\\s+et\\s*al\\.?))?[,\\s]*\\(?\\s*((?:19|20)\\d{2}[a-z]?)\\s*\\)?`,
    "gu"
  );
  const orphans = {};
  let m;
  while ((m = citationRe.exec(cleanBody)) !== null) {
    const sur1raw = m[1], sur2raw = m[2], isEtAl = !!m[3], year = m[4];
    const sur1 = stripPossessive(sur1raw), sur2 = sur2raw ? stripPossessive(sur2raw) : "";
    const yearClean = year.replace(/[a-z]$/, "");
    const candidates = [sur1, sur2].filter(Boolean);
    if (!candidates.length) continue;

    // A surname+year pair only "explains away" this citation if it's
    // compatible with how the citation was written: an "et al." citation
    // must be backed by a reference with 3+ authors (single/two-author
    // references cited as "et al." actually belong to a different,
    // missing reference and should still surface as an orphan). Check the
    // exact year first (preserving any a/b disambiguation suffix) and only
    // fall back to the bare year if that fails.
    const pairIsKnown = (s, y) => {
      const counts = knownPairs[`${s.toLowerCase()}_${y}`];
      if (!counts) return false;
      return isEtAl ? counts.some((c) => c >= 3) : true;
    };
    const isKnown = candidates.some((s) => pairIsKnown(s, year) || (year !== yearClean && pairIsKnown(s, yearClean)));
    if (isKnown) continue;

    const falsePositiveWords = [
      "table", "figure", "see", "chapter", "section", "equation", "note",
      "january", "february", "march", "april", "may", "june", "july",
      "august", "september", "october", "november", "december",
    ];
    if (falsePositiveWords.includes(sur1.toLowerCase())) continue;

    const tail = cleanBody.slice(m.index + m[0].length, m.index + m[0].length + 6);
    if (/^-\d/.test(tail)) continue;

    const key = `${sur1}|${sur2 || ""}|${isEtAl ? "etal" : ""}|${yearClean}`;
    if (!orphans[key]) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(cleanBody.length, m.index + m[0].length + 40);
      orphans[key] = {
        sur1: sur1 + (isEtAl ? " et al." : ""), sur2: sur2 || "", year: yearClean,
        context: cleanBody.slice(start, end).trim(),
        count: 0,
      };
    }
    orphans[key].count++;
  }
  return orphans;
}

// True if the matched span's surname-year gap reads as an "et al." citation
// that this reference (with authorCount listed authors) shouldn't claim.
function isInvalidEtAlMatch(matchedText, authorCount) {
  return (authorCount || 1) < 3 && /et\s*al\.?/i.test(matchedText);
}

function linkAndReport(bodyContent, entries, dupIds) {
  const cleanBody = cleanHtmlToPureText(bodyContent);
  let linkedBody = bodyContent;
  const linkedEntries = [], unlinkedEntries = [];

  for (const e of entries) {
    const year = e.year, spanId = e.id;
    // Try every alias (full multi-word surname first, then each individual
    // word) - not just the combined surname - so a compound surname like
    // "Kosterman Zoller" still matches an in-text "Kosterman", and an
    // organization reference like "United Nations Development Programme
    // (UNDP)" still matches an in-text "UNDP".
    const surnames = e.surnameAliases && e.surnameAliases.length
      ? e.surnameAliases
      : (e.surnames && e.surnames.length ? e.surnames : [e.surname]);

    let matchSurname = null, matchMethod = null, found = null;

    // Two passes, not one: check every author's TIGHT (exact, adjacent)
    // pattern first, and only fall back to LOOSE patterns if nobody got a
    // tight hit. Previously this checked ALL of author #1's patterns
    // (tight *and* loose) before ever looking at author #2/#3 - so a weak
    // loose coincidence on the first-listed author (e.g. "Provan") always
    // won, even when a later author (e.g. "Veazie") had an exact tight
    // match sitting right there in the text. That's why the "doubtful
    // author" badge kept naming the first author no matter what.
    for (const looseOnly of [false, true]) {
      for (const surname of surnames) {
        const patterns = buildPatterns(surname, year).filter((p) => p.loose === looseOnly);
        for (const p of patterns) {
          const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
          let mm;
          while ((mm = re.exec(cleanBody)) !== null) {
            if (isInvalidEtAlMatch(mm[0], e.authorCount)) continue;
            found = mm;
            matchSurname = surname;
            matchMethod = p.loose ? "loose" : "tight";
            break;
          }
          if (found) break;
        }
        if (found) break;
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
          if (isInvalidEtAlMatch(mm2[0], e.authorCount)) continue;
          const start = Math.max(0, mm2.index - 35);
          const end = Math.min(cleanBody.length, mm2.index + mm2[0].length + 35);
          const snippet = cleanBody.slice(start, end).trim();
          if (seenPlain.has(snippet)) continue;
          seenPlain.add(snippet);
          contexts.push({ plain: snippet, html: highlightMatch(snippet, matchSurname, year) });
          if (contexts.length >= 3) break outer;
        }
      }

      // Find the same valid (non-et-al, when applicable) occurrence in the
      // raw HTML to place the hyperlink, rather than always the first raw
      // occurrence of the surname (which might be a different, et-al,
      // citation belonging to a different reference).
      const htmlRe = new RegExp(`${escRe(matchSurname)}(?:[^<]{0,60})${escRe(year)}`, "gi");
      let mLink;
      while ((mLink = htmlRe.exec(linkedBody)) !== null) {
        if (isInvalidEtAlMatch(mLink[0], e.authorCount)) continue;
        if (mLink[0].includes("href=") || mLink[0].includes("</a>")) continue;
        linkedBody = linkedBody.slice(0, mLink.index) +
          `<a href="#${spanId}" style="color:#2563eb;text-decoration:underline;">${mLink[0]}</a>` +
          linkedBody.slice(mLink.index + mLink[0].length);
        break;
      }

      linkedEntries.push({
        id: spanId, displayName: e.displayName, contexts,
        isDuplicate: dupIds.has(spanId), matchMethod, matchedSurname: matchSurname,
      });
    } else {
      let reason = "No occurrence of author surname found in text";
      let anySurnameFound = false;
      for (const surname of surnames) {
        if (new RegExp(`${UB}${escRe(surname)}${UE}`, "iu").test(cleanBody)) {
          anySurnameFound = true;
          const widePattern = new RegExp(
            `${UB}${escRe(surname)}${UE}[\\s\\S]{0,150}\\b${escRe(year)}\\b|\\b${escRe(year)}\\b[\\s\\S]{0,150}${UB}${escRe(surname)}${UE}`, "iu"
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
        isDuplicate: dupIds.has(spanId), reason, surnameAliases: surnames,
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
  const crossRefBadge = (info) => info
    ? ` <span title="${escapeHtml(info.detail)}" style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;">⚠ check "${escapeHtml(info.surname)}": also in ${escapeHtml(info.detail)}</span>`
    : '';

  // Surname -> where else it shows up, so a "loose match" linked row can be
  // flagged if the same surname also sits in the Unlinked or Orphan tables
  // (a strong signal the loose match may have grabbed the wrong citation -
  // see the single-author-vs-"et al." class of bug).
  const unlinkedBySurname = new Map();
  for (const e of unlinkedEntries) {
    for (const s of (e.surnameAliases && e.surnameAliases.length ? e.surnameAliases : [])) {
      const k = s.toLowerCase();
      if (!unlinkedBySurname.has(k)) unlinkedBySurname.set(k, []);
      unlinkedBySurname.get(k).push(e.id);
    }
  }
  const orphanBySurname = new Map();
  for (const k of Object.keys(orphans)) {
    const d = orphans[k];
    for (const s of [d.sur1.replace(/\s+et al\.?$/i, ""), d.sur2].filter(Boolean)) {
      const key = s.toLowerCase();
      if (!orphanBySurname.has(key)) orphanBySurname.set(key, 0);
      orphanBySurname.set(key, orphanBySurname.get(key) + 1);
    }
  }
  const crossRefFor = (e) => {
    if (e.matchMethod !== "loose" || !e.matchedSurname) return null;
    const k = e.matchedSurname.toLowerCase();
    const hits = [];
    if (unlinkedBySurname.has(k)) hits.push(`Unlinked (${unlinkedBySurname.get(k).join(", ")})`);
    if (orphanBySurname.has(k)) hits.push(`Orphan citations (${orphanBySurname.get(k)})`);
    if (!hits.length) return null;
    // Name the exact surname the loose match latched onto, so the reader
    // immediately knows which author in a multi-author reference is the
    // uncertain one - e.g. "Provan, K. G., Nakama, L., Veazie, M. A. (2003)"
    // matched on "Veazie", and "Veazie" is also an orphan citation elsewhere.
    return { surname: e.matchedSurname, detail: hits.join(" & ") };
  };

  // Clean up spacing right inside parentheses (e.g. "( Anheier, 2005 )" ->
  // "(Anheier, 2005)") so the copied text matches exactly what a Ctrl+F
  // search in the original Word file expects, with no odd extra spaces.
  const cleanForCopy = (s) => String(s)
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();

  const contextCell = (contexts) => contexts.length
    ? contexts.map((c) => `<div class="ctx-line"><span class="ctx-copy" data-copy="${escapeHtml(cleanForCopy(c.plain))}" title="Click to copy">${c.html}</span></div>`).join("")
    : "-";

  const linkedRows = linkedEntries.map((e) => `
        <tr class="linked-row" data-method="${e.matchMethod}">
            <td>${escapeHtml(e.id)}${dupBadge(e.isDuplicate)}</td>
            <td><strong>${escapeHtml(e.displayName)}</strong>${methodBadge(e.matchMethod)}${crossRefBadge(crossRefFor(e))}</td>
            <td>${contextCell(e.contexts)}</td>
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
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:16px;background:#f8fafc;color:#1a202c;}
.container{max-width:1640px;margin:0 auto;background:#fff;padding:30px 44px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h1{color:#0f172a;border-bottom:3px solid #3498db;padding-bottom:15px;}
.stats{display:flex;gap:15px;margin:25px 0;flex-wrap:wrap;}
.stat{flex:1;min-width:150px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;text-align:center;}
.stat .num{font-size:28px;font-weight:700;}
.filter-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 20px;padding:12px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;}
.filter-label{font-size:13px;font-weight:600;color:#475569;margin-right:2px;}
.filter-btn{border:1px solid #cbd5e1;background:#fff;color:#334155;padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer;transition:all .15s ease;}
.filter-btn:hover{border-color:#94a3b8;background:#f8fafc;}
.filter-btn.active{background:#0f172a;border-color:#0f172a;color:#fff;}
.filter-count{opacity:.65;font-size:12px;margin-left:2px;}
table{width:100%;border-collapse:collapse;margin:15px 0 35px;}
th{background:#0f172a;color:#fff;padding:12px;text-align:left;font-size:13px;}
td{padding:10px;border:1px solid #e2e8f0;font-size:13px;vertical-align:top;}
.linked-row{background:#f0fdf4;}
.unlinked-row{background:#fef2f2;}
.orphan-row{background:#fff7ed;}
.reason-cell{color:#92400e;font-style:italic;}
mark{padding:1px 2px;border-radius:3px;}
.ctx-line{margin:0 0 10px;padding-bottom:10px;border-bottom:1px dashed #e2e8f0;}
.ctx-line:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none;}
.ctx-copy{cursor:pointer;border-radius:4px;padding:1px 3px;transition:background .15s ease;}
.ctx-copy:hover{background:#eff6ff;outline:1px dashed #93c5fd;}
.ctx-copy.copied{background:#dcfce7 !important;outline:1px solid #22c55e;}
.copy-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;z-index:999;}
.copy-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
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
<div class="filter-bar" role="group" aria-label="Filter report rows">
  <span class="filter-label">Filter:</span>
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="loose">Loose Match <span class="filter-count">(${looseCount})</span></button>
  <button class="filter-btn" data-filter="unlinked">Unlinked <span class="filter-count">(${unlinkedCount})</span></button>
  <button class="filter-btn" data-filter="orphan">Orphan <span class="filter-count">(${orphanCount})</span></button>
</div>
<section data-section="linked">
<h2>Linked Citations (${linkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"loose match" = surname and year found with extra words between them rather than directly adjacent. Matched <mark style="background:#fef08a;">surname</mark> and <mark style="background:#bbf7d0;">year</mark> are highlighted.</p>
<p style="color:#64748b;font-size:13px;">⚠ "check '&lt;name&gt;': also in ..." = the named surname is a loose match here but also shows up in the Unlinked or Orphan tables below - worth a manual look, since the loose match may have grabbed a different citation of the same surname.</p>
<p style="color:#64748b;font-size:13px;">Click any line in "Context Found" to copy it - handy for Ctrl+F in your Word file.</p>
<table><thead><tr><th>Bib ID</th><th>Reference</th><th>Context Found</th></tr></thead>
<tbody>${linkedRows}</tbody></table>
</section>
<section data-section="unlinked">
<h2>Unlinked Citations (${unlinkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"Reason" diagnoses why no match was made.</p>
<table><thead><tr><th>Bib ID</th><th>Reference</th><th>Reference Text</th><th>Reason</th></tr></thead>
<tbody>${unlinkedRows}</tbody></table>
</section>
<section data-section="orphan">
<h2>Orphan In-Text Citations (${orphanCount})</h2>
<p style="color:#64748b;font-size:13px;">Citations in the body text with NO matching reference entry - need a reference added, or are a typo.</p>
<table><thead><tr><th>Citation</th><th>Context</th><th>Occurrences</th><th>Ref No</th></tr></thead>
<tbody>${orphanRows}</tbody></table>
</section>
</div>
<div class="copy-toast" id="copy-toast">Copied!</div>
<script>
(function () {
  var filterBtns = document.querySelectorAll('.filter-btn');
  var sections = document.querySelectorAll('[data-section]');
  var linkedRowsEls = document.querySelectorAll('.linked-row');

  function applyFilter(filter) {
    sections.forEach(function (sec) {
      if (filter === 'all') { sec.style.display = ''; return; }
      if (filter === 'loose') { sec.style.display = sec.dataset.section === 'linked' ? '' : 'none'; return; }
      sec.style.display = sec.dataset.section === filter ? '' : 'none';
    });
    linkedRowsEls.forEach(function (row) {
      row.style.display = (filter === 'loose' && row.dataset.method !== 'loose') ? 'none' : '';
    });
    filterBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.filter === filter); });
  }

  filterBtns.forEach(function (b) {
    b.addEventListener('click', function () { applyFilter(b.dataset.filter); });
  });
})();
</script>
<script>
(function () {
  var toast = document.getElementById('copy-toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1200);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.ctx-copy') : null;
    if (!el) return;
    var text = el.getAttribute('data-copy') || '';
    if (!text) return;
    var mark = function () {
      el.classList.add('copied');
      setTimeout(function () { el.classList.remove('copied'); }, 900);
      showToast('Copied to clipboard');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(mark).catch(function () {
        if (fallbackCopy(text)) mark(); else showToast('Could not copy - please select manually');
      });
    } else {
      if (fallbackCopy(text)) mark(); else showToast('Could not copy - please select manually');
    }
  });
})();
</script>
</body></html>`;
}

function generateReport(htmlContent) {
  const [bodyContent, bibContent] = splitBodyAndReferences(htmlContent);
  const entries = parseBibEntries(bibContent);
  const dupIds = findDuplicates(entries);
  const { linkedEntries, unlinkedEntries } = linkAndReport(bodyContent, entries, dupIds);
  const orphans = findOrphanCitations(bodyContent, entries);
  return buildReportHtml(entries.length, linkedEntries, unlinkedEntries, dupIds, orphans);
}

