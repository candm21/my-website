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
    let authorRunCount = 0;
    let firstAuthorCaptured = false;
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
        authorRunCount++;
        // Only the first author contributes match aliases - a citation
        // naming any other author on the list isn't valid APA form, and
        // should surface as unlinked/orphan rather than being silently
        // absorbed by this reference.
        if (!firstAuthorCaptured) {
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
          firstAuthorCaptured = true;
        }
      }
    }

    const dedupe = (arr) => [...new Set(arr)];
    const uSurnames = dedupe(surnames);
    const uAliases = dedupe(surnameAliases);
    const surname = uSurnames[0] || "";

    if (!surname || !yearStr) continue;

    // Pull out an already-present DOI, if the reference happens to have
    // one typed in (e.g. "... 296-314. https://doi.org/10.1002/nml.21322"
    // or "doi:10.1002/nml.21322"). Strip a trailing period/comma/paren
    // that's actually sentence punctuation, not part of the DOI.
    const doiMatch = /\b10\.\d{4,9}\/[^\s"'<>]+/i.exec(cleanText);
    const existingDoi = doiMatch ? doiMatch[0].replace(/[.,;)\]]+$/, "") : null;

    entries.push({
      id: spanId,
      cleanText,
      surname,
      surnames: uSurnames,
      surnameAliases: uAliases,
      existingDoi,
      // Rough count of listed authors (one per comma/&/and-separated chunk
      // that yielded a name). Used to sanity-check "et al." citations -
      // a single- or two-author reference should never be matched by an
      // "X et al." in-text citation; that citation belongs to a different,
      // often-missing, reference.
      authorCount: authorRunCount || 1,
      year: yearStr,
      displayName: `${firstPart.slice(0, 40)} (${yearStr})`,
      // Original inline markup (italics, bold, etc.) for this entry, kept
      // so an exported reference list can reproduce the source doc's
      // formatting instead of the tag-stripped plain-text cleanText.
      rawHtml: entry.trim(),
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
    for (const surname of surnames) {
      const patterns = buildPatterns(surname, year);
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
        firstAuthorSurname: e.surname, surnameAliases: surnames,
      });
    } else {
      let reason = "No occurrence of author surname found in text";
      let anySurnameFound = false;
      let foundContext = null;
      for (const surname of surnames) {
        const re = new RegExp(`${UB}${escRe(surname)}${UE}`, "iu");
        const mFound = re.exec(cleanBody);
        if (mFound) {
          anySurnameFound = true;
          const start = Math.max(0, mFound.index - 35);
          const end = Math.min(cleanBody.length, mFound.index + mFound[0].length + 35);
          const snippet = cleanBody.slice(start, end).trim();
          foundContext = { plain: snippet, html: highlightMatch(snippet, surname, year) };
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
        context: foundContext, year: e.year,
      });
    }
  }

  return { linkedBody, linkedEntries, unlinkedEntries };
}

function levenshtein(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

// "Did you mean?" - pair up Unlinked references with same-year Orphan
// citations whose surname is a near-miss (small edit distance), the exact
// shape of a spelling typo between the reference list and the body text
// (e.g. "Thornton" in the reference list vs. "Thorton" in the citation).
// Both maps are keyed so the renderer can look up a suggestion by id.
function buildDidYouMeanSuggestions(unlinkedEntries, orphans) {
  const unlinkedSuggestion = {};
  const orphanSuggestion = {};
  const orphanKeys = Object.keys(orphans);

  for (const e of unlinkedEntries) {
    const aliases = e.surnameAliases && e.surnameAliases.length ? e.surnameAliases : [];
    let best = null;
    for (const ok of orphanKeys) {
      const d = orphans[ok];
      if (d.year !== e.year) continue;
      const orphanNames = [d.sur1.replace(/\s+et al\.?$/i, ""), d.sur2].filter(Boolean);
      for (const a of aliases) {
        for (const on of orphanNames) {
          if (a.toLowerCase() === on.toLowerCase()) continue; // exact match would've linked already
          const dist = levenshtein(a, on);
          const maxLen = Math.max(a.length, on.length);
          if (dist === 0 || dist > 2 || maxLen < 4) continue;
          const similarity = Math.round((1 - dist / maxLen) * 100);
          if (similarity < 65) continue;
          if (!best || dist < best.dist) {
            best = { dist, similarity, orphanKey: ok, orphanLabel: `${d.sur1}${d.sur2 ? " & " + d.sur2 : ""} (${d.year})` };
          }
        }
      }
    }
    if (best) {
      unlinkedSuggestion[e.id] = best;
      if (!orphanSuggestion[best.orphanKey] || best.similarity > orphanSuggestion[best.orphanKey].similarity) {
        orphanSuggestion[best.orphanKey] = { similarity: best.similarity, refId: e.id, refLabel: e.displayName };
      }
    }
  }
  return { unlinkedSuggestion, orphanSuggestion };
}

function cleanForCopy(text) {
  return String(text)
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildReportHtml(total, linkedEntries, unlinkedEntries, dupIds, orphans, allEntries) {
  const { unlinkedSuggestion, orphanSuggestion } = buildDidYouMeanSuggestions(unlinkedEntries, orphans);

  const dupBadge = (isDup) => isDup
    ? ' <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;">Duplicate</span>'
    : '';
  const methodBadge = (method) => method === "loose"
    ? ' <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;">loose match</span>'
    : '';
  const crossRefBadge = (surname, msg) => msg
    ? ` <span title="${escapeHtml(`'${surname}' `+msg)}" style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;">⚠ check "${escapeHtml(surname)}" - also in ${escapeHtml(msg)}</span>`
    : '';
  const suggestBadge = (text) => text
    ? `<div style="margin-top:4px;font-size:12px;color:#0369a1;">💡 ${escapeHtml(text)}</div>`
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
    if (e.matchMethod !== "loose") return "";
    const aliases = e.surnameAliases && e.surnameAliases.length ? e.surnameAliases : [e.matchedSurname].filter(Boolean);
    const unlinkedHits = new Set(), orphanIds = new Set();
    let orphanTotal = 0;
    for (const s of aliases) {
      const k = s.toLowerCase();
      if (unlinkedBySurname.has(k)) unlinkedBySurname.get(k).forEach((id) => unlinkedHits.add(id));
      if (orphanBySurname.has(k)) orphanTotal += orphanBySurname.get(k);
    }
    const hits = [];
    if (unlinkedHits.size) hits.push(`Unlinked (${[...unlinkedHits].join(", ")})`);
    if (orphanTotal) hits.push(`Orphan citations (${orphanTotal})`);
    return hits.join(" & ");
  };

  const linkedRows = linkedEntries.map((e) => {
    const ctxHtml = e.contexts.map((c) =>
      `<span class="ctx-copy" title="Click to copy" data-copy="${escapeHtml(cleanForCopy(c.plain))}">${c.html}</span>`
    ).join("<br>") || "-";
    const badgeName = e.firstAuthorSurname || e.matchedSurname || "";
    const crossMsg = crossRefFor(e);
    const qIssue = crossMsg ? `Loose match - also appears in ${crossMsg}` : (e.matchMethod === "loose" ? "Loose match - please verify against the reference." : "");
    const qContext = e.contexts[0] ? cleanForCopy(e.contexts[0].plain) : "";
    return `
        <tr class="linked-row" data-method="${escapeHtml(e.matchMethod || "")}">
            <td class="check-cell"><input type="checkbox" class="query-check" data-qtype="Linked citation" data-qid="${escapeHtml(e.id)}" data-qref="${escapeHtml(e.displayName)}" data-qissue="${escapeHtml(qIssue)}" data-qcontext="${escapeHtml(qContext)}"></td>
            <td>${escapeHtml(e.id)}${dupBadge(e.isDuplicate)}</td>
            <td><strong>${escapeHtml(e.displayName)}</strong>${methodBadge(e.matchMethod)}${crossRefBadge(badgeName, crossMsg)}</td>
            <td>${ctxHtml}</td>
        </tr>`;
  }).join("") || `
        <tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px;">No linked citations found.</td></tr>`;

  const unlinkedRows = unlinkedEntries.map((e) => {
    const ctxCell = e.context
      ? `<span class="ctx-copy" title="Click to copy" data-copy="${escapeHtml(cleanForCopy(e.context.plain))}">${e.context.html}</span>`
      : '<span style="color:#94a3b8;">-</span>';
    const sug = unlinkedSuggestion[e.id];
    const sugText = sug ? `Possibly matches orphan citation "${sug.orphanLabel}" (${sug.similarity}% similar) - check for a typo.` : "";
    const qIssue = (e.reason || "") + (sug ? ` | Did you mean: "${sug.orphanLabel}"?` : "");
    const qContext = e.context ? cleanForCopy(e.context.plain) : "";
    return `
        <tr class="unlinked-row">
            <td class="check-cell"><input type="checkbox" class="query-check" data-qtype="Unlinked reference" data-qid="${escapeHtml(e.id)}" data-qref="${escapeHtml(e.displayName)}" data-qissue="${escapeHtml(qIssue)}" data-qcontext="${escapeHtml(qContext)}"></td>
            <td>${escapeHtml(e.id)}${dupBadge(e.isDuplicate)}</td>
            <td><strong>${escapeHtml(e.displayName)}</strong></td>
            <td>${escapeHtml(e.cleanText.slice(0, 150))}${e.cleanText.length > 150 ? "..." : ""}</td>
            <td>${ctxCell}</td>
            <td class="reason-cell">${escapeHtml(e.reason || "")}${suggestBadge(sugText)}</td>
        </tr>`;
  }).join("") || `
        <tr><td colspan="6" style="text-align:center;color:#27ae60;padding:20px;">All references were linked.</td></tr>`;

  const orphanKeys = Object.keys(orphans);
  const orphanRows = orphanKeys.map((k) => {
    const d = orphans[k];
    const citationLabel = `${d.sur1}${d.sur2 ? " & " + d.sur2 : ""} (${d.year})`;
    const sug = orphanSuggestion[k];
    const sugText = sug ? `Possibly matches reference ${sug.refId} "${sug.refLabel}" (${sug.similarity}% similar) - check for a typo.` : "";
    const qIssue = "No matching reference entry found." + (sug ? ` | Did you mean: ${sug.refId} "${sug.refLabel}"?` : "");
    return `
        <tr class="orphan-row">
            <td class="check-cell"><input type="checkbox" class="query-check" data-qtype="Orphan citation" data-qid="" data-qref="${escapeHtml(citationLabel)}" data-qissue="${escapeHtml(qIssue)}" data-qcontext="${escapeHtml(cleanForCopy(d.context))}"></td>
            <td><strong>${escapeHtml(citationLabel)}</strong>${suggestBadge(sugText)}</td>
            <td><span class="ctx-copy" title="Click to copy" data-copy="${escapeHtml(cleanForCopy(d.context))}">${escapeHtml(d.context)}</span></td>
            <td style="text-align:center;">${d.count}</td>
            <td style="text-align:center;color:#9a3412;font-style:italic;">Unnumbered</td>
        </tr>`;
  }).join("") || `
        <tr><td colspan="5" style="text-align:center;color:#27ae60;padding:20px;">No orphan citations found - every in-text citation has a matching reference entry.</td></tr>`;

  // ---- DOI Finder section (queries Crossref.org live, in the browser, when
  // the report's own "Run Crossref DOI Lookup" button is clicked). Rows are
  // rendered here with placeholders; the report's embedded script fills
  // each one in as its lookup resolves. Entries that already have a DOI
  // typed into the reference are shown immediately, no lookup needed. ----
  const doiRows = allEntries.map((e) => {
    const already = e.existingDoi
      ? `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px;font-size:11px;">✅ already has DOI</span>`
      : `<span style="color:#94a3b8;">⏳ not checked</span>`;
    const doiCell = e.existingDoi
      ? `<span class="ctx-copy" title="Click to copy" data-copy="${escapeHtml(e.existingDoi)}">${escapeHtml(e.existingDoi)}</span>`
      : "-";
    return `
        <tr class="doi-row" id="doi-row-${escapeHtml(e.id)}">
            <td>${escapeHtml(e.id)}</td>
            <td class="doi-ref-cell">${escapeHtml(e.cleanText)}</td>
            <td class="doi-status-cell">${already}</td>
            <td class="doi-match-cell">-</td>
            <td class="doi-doi-cell">${doiCell}</td>
        </tr>`;
  }).join("") || `
        <tr><td colspan="5" style="text-align:center;color:#64748b;padding:20px;">No references parsed.</td></tr>`;

  const doiEntriesForJs = allEntries.map((e) => ({
    id: e.id, cleanText: e.cleanText, existingDoi: e.existingDoi,
    surnames: e.surnames, year: e.year, rawHtml: e.rawHtml,
  }));
  const doiEntriesJson = JSON.stringify(doiEntriesForJs).replace(/<\/script/gi, "<\\/script");
  const doiCandidateCount = allEntries.filter((e) => !e.existingDoi).length;

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
.container{max-width:1800px;width:97%;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h1{color:#0f172a;border-bottom:3px solid #3498db;padding-bottom:15px;}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin:25px 0;}
.stat{flex:1;min-width:150px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;text-align:center;}
.stat .num{font-size:28px;font-weight:700;}
table{width:100%;max-width:100%;border-collapse:collapse;margin:15px 0 35px;table-layout:auto;}
th{background:#0f172a;color:#fff;padding:12px;text-align:left;font-size:13px;}
td{padding:10px;border:1px solid #e2e8f0;font-size:13px;vertical-align:top;}
.dist-intro{font-weight:700;color:#0f172a;font-size:15px;margin:22px 0 10px;}
.dist-heading{font-weight:800;color:#0f172a;font-size:18px;margin:0 0 12px;}
.dist-table{max-width:720px;}
.dist-table th{background:#0f172a;}
.dist-table td:first-child{font-weight:700;white-space:nowrap;}
.dist-table td:nth-child(1){color:#0f172a;}
.report-footer{margin-top:40px;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;font-size:13px;color:#64748b;font-weight:600;}
.report-footer strong{color:#0f172a;}
/* Density (S|M|L) sizing for all report tables */
.density-s table th{padding:6px 8px;font-size:11px;}
.density-s table td{padding:5px 8px;font-size:11px;}
.density-m table th{padding:12px;font-size:13px;}
.density-m table td{padding:10px;font-size:13px;}
.density-l table th{padding:16px 14px;font-size:15px;}
.density-l table td{padding:14px;font-size:15px;}
.size-toggle{display:inline-flex;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;margin-left:8px;}
.size-btn{background:#fff;border:none;border-right:1px solid #e2e8f0;color:#334155;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;}
.size-btn:last-child{border-right:none;}
.size-btn.active{background:#0f172a;color:#fff;}
.linked-row{background:#f0fdf4;}
.unlinked-row{background:#fef2f2;}
.orphan-row{background:#fff7ed;}
.reason-cell{color:#92400e;font-style:italic;}
mark{padding:1px 2px;border-radius:3px;}
.ctx-copy{cursor:pointer;border-radius:4px;padding:1px 2px;transition:background .15s ease;}
.ctx-copy:hover{background:#e0f2fe;}
.ctx-copy.copied{background:#bbf7d0 !important;}
.filter-bar{display:flex;gap:8px;margin:20px 0 30px;flex-wrap:wrap;position:sticky;top:0;background:#fff;padding:10px 0;z-index:5;}
.filter-btn{background:#f1f5f9;border:1px solid #e2e8f0;color:#334155;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s ease;}
.filter-btn:hover{background:#e2e8f0;}
.filter-btn.active{background:#0f172a;color:#fff;border-color:#0f172a;}
.report-section{scroll-margin-top:110px;}
.live-search{margin-left:auto;padding:8px 14px;border:1px solid #e2e8f0;border-radius:20px;font-size:13px;min-width:240px;outline:none;}
.live-search:focus{border-color:#0f172a;}
.check-cell{width:34px;text-align:center;}
.query-check{width:16px;height:16px;cursor:pointer;}
.query-bar{display:flex;align-items:center;gap:10px;margin:0 0 20px;padding:10px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:13px;color:#1e3a8a;position:sticky;top:56px;z-index:4;}
.query-btn{background:#fff;border:1px solid #93c5fd;color:#1d4ed8;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s ease;}
.query-btn:hover{background:#dbeafe;}
.query-btn-ghost{border-color:#cbd5e1;color:#475569;}
.query-btn-ghost:hover{background:#f1f5f9;}
.doi-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 20px;font-size:12px;color:#475569;}
.doi-controls #doi-email-input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;min-width:220px;outline:none;}
.doi-controls #doi-email-input:focus{border-color:#0f172a;}
#doi-run-btn:disabled{opacity:.6;cursor:default;}
.doi-ref-cell{max-width:480px;}
.doi-match-cell{max-width:340px;}
.doi-match-hit{background:#bbf7d0;padding:1px 2px;border-radius:3px;}
.doi-export{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 8px;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;}
.doi-export-note{font-size:12px;color:#166534;}
</style></head>
<body class="density-m"><div class="container">
<h1>Reference Cross-Link Audit Report</h1>
<h2 class="dist-heading">The distinction across your three tables</h2>
<table class="dist-table">
<thead><tr><th>Table</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>Linked</td><td>Citation ↔ reference correctly paired</td></tr>
<tr><td>Unlinked</td><td>Reference exists, but no matching citation found anywhere in the text</td></tr>
<tr><td>Orphan In-Text</td><td>Citation exists, but no reference matches it at all</td></tr>
</tbody>
</table>
<div class="stats">
  <div class="stat"><div class="num">${total}</div>Total References</div>
  <div class="stat"><div class="num" style="color:#16a34a;">${linkedCount}</div>Linked (${pct}%)</div>
  <div class="stat"><div class="num" style="color:#1d4ed8;">${looseCount}</div>Loose Matches</div>
  <div class="stat"><div class="num" style="color:#dc2626;">${unlinkedCount}</div>Unlinked</div>
  <div class="stat"><div class="num" style="color:#d97706;">${dupCount}</div>Duplicate Entries</div>
  <div class="stat"><div class="num" style="color:#ea580c;">${orphanCount}</div>Orphan In-Text Citations</div>
</div>
<div class="filter-bar" id="filter-bar">
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="loose">Loose Match (${looseCount})</button>
  <button class="filter-btn" data-filter="orphan">Orphan (${orphanCount})</button>
  <button class="filter-btn" data-filter="intext">In Text (${unlinkedCount})</button>
  <button class="filter-btn" data-filter="doi">DOI (${doiCandidateCount})</button>
  <input type="text" id="live-search" class="live-search" placeholder="🔎 Search author, year, or text...">
  <div class="size-toggle" id="size-toggle" role="group" aria-label="Table density">
    <button class="size-btn" data-size="s">S</button>
    <button class="size-btn active" data-size="m">M</button>
    <button class="size-btn" data-size="l">L</button>
  </div>
</div>
<div class="query-bar" id="query-bar">
  <span id="query-count">0 selected</span>
  <button class="query-btn" id="query-copy-btn">📋 Copy Query List</button>
  <button class="query-btn" id="query-download-btn">⬇ Download .txt</button>
  <button class="query-btn query-btn-ghost" id="query-clear-btn">Clear selection</button>
</div>
<section class="report-section" data-section="linked">
<h2>Linked Citations (${linkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"loose match" = surname and year found with extra words between them rather than directly adjacent. Matched <mark style="background:#fef08a;">surname</mark> and <mark style="background:#bbf7d0;">year</mark> are highlighted.</p>
<p style="color:#64748b;font-size:13px;">⚠ "check ..." = this loose match's named surname also appears in the Unlinked or Orphan tables below - worth a manual look, since the loose match may have grabbed a different citation of the same surname.</p>
<p style="color:#64748b;font-size:13px;">Click any context snippet to copy it (cleaned of extra spacing) for a Ctrl+F search in the Word file. Tick a row to add it to your query list.</p>
<table><thead><tr><th class="check-cell"></th><th>Bib ID</th><th>Reference</th><th>Context Found</th></tr></thead>
<tbody>${linkedRows}</tbody></table>
</section>
<section class="report-section" data-section="unlinked">
<h2>Unlinked Citations (${unlinkedCount})</h2>
<p style="color:#64748b;font-size:13px;">"Context Found" shows where that surname turns up in the body text even though it didn't fully match (click to copy); "Reason" diagnoses why no match was made. 💡 marks a likely typo match with an orphan citation below.</p>
<table><thead><tr><th class="check-cell"></th><th>Bib ID</th><th>Reference</th><th>Reference Text</th><th>Context Found</th><th>Reason</th></tr></thead>
<tbody>${unlinkedRows}</tbody></table>
</section>
<section class="report-section" data-section="orphan">
<h2>Orphan In-Text Citations (${orphanCount})</h2>
<p style="color:#64748b;font-size:13px;">Citations in the body text with NO matching reference entry - need a reference added, or are a typo. Click a context to copy it. 💡 marks a likely typo match with an unlinked reference above.</p>
<table><thead><tr><th class="check-cell"></th><th>Citation</th><th>Context</th><th>Occurrences</th><th>Ref No</th></tr></thead>
<tbody>${orphanRows}</tbody></table>
</section>
<section class="report-section" data-section="doi">
<h2>DOI Finder <span style="color:#64748b;font-weight:400;font-size:14px;">(${doiCandidateCount} to check)</span></h2>
<p style="color:#64748b;font-size:13px;">Looks up each reference against Crossref.org live in your browser and scores how confident the match is. 🟢 ≥85% - safe to accept · 🟡 60-84% - quick human check · 🔴 below 60% - Crossref found nothing confident (common for books, older items, or anything with no registered DOI - that's not a tool failure). Click a found DOI to copy a ready-to-paste "reference + doi.org link" line for Word.</p>
<div class="doi-controls">
  <label for="doi-email-input">Crossref polite-pool email (optional, speeds up lookups):</label>
  <input type="email" id="doi-email-input" placeholder="you@example.com">
  <button class="query-btn" id="doi-run-btn">🔍 Run Crossref DOI Lookup</button>
</div>
<div class="stats" id="doi-stats" style="display:none;">
  <div class="stat"><div class="num" id="doi-stat-already">0</div>Already Had DOI</div>
  <div class="stat"><div class="num" style="color:#16a34a;" id="doi-stat-green">0</div>Auto-matched (≥85%)</div>
  <div class="stat"><div class="num" style="color:#d97706;" id="doi-stat-yellow">0</div>Needs QC (60-84%)</div>
  <div class="stat"><div class="num" style="color:#dc2626;" id="doi-stat-red">0</div>Not Found</div>
</div>
<table><thead><tr><th>Bib ID</th><th>Reference</th><th>Status</th><th>Crossref Match</th><th>DOI</th></tr></thead>
<tbody id="doi-tbody">${doiRows}</tbody></table>
<div class="doi-export" id="doi-export">
  <strong style="color:#14532d;font-size:13px;">Download Reference List</strong>
  <button class="query-btn" id="doi-export-html-btn">⬇ Download as HTML</button>
  <button class="query-btn" id="doi-export-doc-btn">⬇ Download as Word (.doc)</button>
  <span class="doi-export-note" id="doi-export-note">Same order, same wording as the source doc - DOIs appended where found.</span>
</div>
</section>
<div class="report-footer">✨ <strong>SelvaPrabhu</strong> · Reference Cross-Link Checker · <strong>C&amp;M Digitals</strong></div>
</div>
<script>window.__DOI_ENTRIES__ = ${doiEntriesJson};</script>
<script>
(function () {
  var filterBtns = document.querySelectorAll('.filter-btn');
  var searchBox = document.getElementById('live-search');
  var linkedSection = document.querySelector('[data-section="linked"]');
  var unlinkedSection = document.querySelector('[data-section="unlinked"]');
  var orphanSection = document.querySelector('[data-section="orphan"]');
  var doiSection = document.querySelector('[data-section="doi"]');
  var allRows = document.querySelectorAll('.linked-row, .unlinked-row, .orphan-row');
  var currentFilter = 'all';

  function applyRowVisibility() {
    var term = (searchBox.value || '').trim().toLowerCase();
    allRows.forEach(function (row) {
      var hiddenByMethod = currentFilter === 'loose' && row.classList.contains('linked-row') && row.getAttribute('data-method') !== 'loose';
      var hiddenBySearch = term.length > 0 && row.textContent.toLowerCase().indexOf(term) === -1;
      row.style.display = (hiddenByMethod || hiddenBySearch) ? 'none' : '';
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      linkedSection.style.display = (currentFilter === 'all' || currentFilter === 'loose') ? '' : 'none';
      unlinkedSection.style.display = (currentFilter === 'all' || currentFilter === 'intext') ? '' : 'none';
      orphanSection.style.display = (currentFilter === 'all' || currentFilter === 'orphan') ? '' : 'none';
      if (doiSection) doiSection.style.display = (currentFilter === 'all' || currentFilter === 'doi') ? '' : 'none';
      if (currentFilter === 'doi' && doiSection) doiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      applyRowVisibility();
    });
  });
  searchBox.addEventListener('input', applyRowVisibility);

  // Table density toggle (S | M | L)
  var sizeBtns = document.querySelectorAll('.size-btn');
  sizeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      sizeBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.body.classList.remove('density-s', 'density-m', 'density-l');
      document.body.classList.add('density-' + btn.getAttribute('data-size'));
    });
  });

  // Click-to-copy for context snippets (silent - no alerts, just a brief flash)
  function flashCopied(el) {
    el.classList.add('copied');
    setTimeout(function () { el.classList.remove('copied'); }, 500);
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* silent */ }
    document.body.removeChild(ta);
  }
  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(function () { fallbackCopy(text); onDone(); });
    } else {
      fallbackCopy(text);
      onDone();
    }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('.ctx-copy');
    if (!el) return;
    var text = el.getAttribute('data-copy') || el.textContent;
    copyText(text, function () { flashCopied(el); });
  });

  // Query list: tick rows, then copy or download a formatted follow-up list
  var queryCountEl = document.getElementById('query-count');
  var copyBtn = document.getElementById('query-copy-btn');
  var downloadBtn = document.getElementById('query-download-btn');
  var clearBtn = document.getElementById('query-clear-btn');

  function updateQueryCount() {
    var n = document.querySelectorAll('.query-check:checked').length;
    queryCountEl.textContent = n + (n === 1 ? ' selected' : ' selected');
  }
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('query-check')) updateQueryCount();
  });

  function buildQueryText() {
    var checked = document.querySelectorAll('.query-check:checked');
    if (!checked.length) return '';
    var lines = ['Citation Query List', 'Generated: ' + new Date().toLocaleString(), '', checked.length + ' item(s) need a closer look:', ''];
    checked.forEach(function (cb, i) {
      var d = cb.dataset;
      var head = (i + 1) + '. [' + (d.qtype || '') + (d.qid ? ' ' + d.qid : '') + '] ' + (d.qref || '');
      lines.push(head);
      if (d.qissue) lines.push('   Issue: ' + d.qissue);
      if (d.qcontext) lines.push('   Text: "' + d.qcontext + '"');
      lines.push('');
    });
    return lines.join('\\n');
  }

  function flashBtn(btn, label) {
    var original = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = original; }, 1400);
  }

  copyBtn.addEventListener('click', function () {
    var text = buildQueryText();
    if (!text) { flashBtn(copyBtn, 'Select a row first'); return; }
    copyText(text, function () { flashBtn(copyBtn, '✅ Copied!'); });
  });

  downloadBtn.addEventListener('click', function () {
    var text = buildQueryText();
    if (!text) { flashBtn(downloadBtn, 'Select a row first'); return; }
    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'citation-query-list.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    flashBtn(downloadBtn, '✅ Downloaded');
  });

  clearBtn.addEventListener('click', function () {
    document.querySelectorAll('.query-check:checked').forEach(function (cb) { cb.checked = false; });
    updateQueryCount();
  });
})();
</script>
<script>
(function () {
  var entries = window.__DOI_ENTRIES__ || [];
  var runBtn = document.getElementById('doi-run-btn');
  var emailInput = document.getElementById('doi-email-input');
  var statsBox = document.getElementById('doi-stats');
  var statAlready = document.getElementById('doi-stat-already');
  var statGreen = document.getElementById('doi-stat-green');
  var statYellow = document.getElementById('doi-stat-yellow');
  var statRed = document.getElementById('doi-stat-red');
  if (!runBtn) return;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, ' ').replace(/\\s+/g, ' ').trim();
  }

  // Wraps the first case-insensitive occurrence of any given term (plain
  // substring match, no regex) in a <mark> so it's visible why a Crossref
  // result was picked. Operates on already-escaped HTML text; terms are
  // escaped the same way before matching so entities line up.
  function highlightHit(escText, termOrTerms) {
    var terms = Array.isArray(termOrTerms) ? termOrTerms : [termOrTerms];
    terms.forEach(function (raw) {
      if (!raw) return;
      var term = esc(String(raw));
      if (!term) return;
      var idx = escText.toLowerCase().indexOf(term.toLowerCase());
      if (idx === -1) return;
      escText = escText.slice(0, idx) + '<mark class="doi-match-hit">' + escText.slice(idx, idx + term.length) + '</mark>' + escText.slice(idx + term.length);
    });
    return escText;
  }

  // Same scoring idea as the DOI-report workflow this replaces: title
  // carries most of the weight, author + year corroborate it. Tuned to
  // work off Crossref's own "bibliographic" relevance ranking rather than
  // trying to out-search it.
  function scoreItem(entry, item) {
    var score = 0, max = 0;
    max += 20;
    var dp = item.issued && item.issued['date-parts'] && item.issued['date-parts'][0];
    var itemYear = dp && dp[0] ? String(dp[0]) : null;
    if (itemYear && itemYear === String(entry.year)) score += 20;
    else if (itemYear && Math.abs(parseInt(itemYear, 10) - parseInt(entry.year, 10)) <= 1) score += 10;

    max += 25;
    var itemAuthors = (item.author || []).map(function (a) { return (a.family || '').toLowerCase(); }).filter(Boolean);
    var entrySurnames = (entry.surnames || []).map(function (s) { return s.toLowerCase(); });
    var authorHit = entrySurnames.some(function (s) {
      return itemAuthors.some(function (a) { return a === s || a.indexOf(s) !== -1 || s.indexOf(a) !== -1; });
    });
    if (authorHit) score += 25;

    max += 55;
    var title = (item.title && item.title[0]) || '';
    if (title) {
      var nTitle = norm(title);
      var nText = norm(entry.cleanText);
      if (nTitle && nText.indexOf(nTitle) !== -1) {
        score += 55;
      } else if (nTitle) {
        var titleTokens = nTitle.split(' ').filter(function (w) { return w.length > 2; });
        var textTokenSet = {};
        nText.split(' ').forEach(function (w) { textTokenSet[w] = true; });
        var hit = 0;
        titleTokens.forEach(function (t) { if (textTokenSet[t]) hit++; });
        var ratio = titleTokens.length ? hit / titleTokens.length : 0;
        score += Math.round(ratio * 55);
      }
    }
    return max ? Math.round((score / max) * 100) : 0;
  }

  function tierFor(score) { return score >= 85 ? 'green' : (score >= 60 ? 'yellow' : 'red'); }

  function tierBadge(tier, score) {
    if (tier === 'green') return '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px;font-size:11px;">🟢 ' + score + '% match</span>';
    if (tier === 'yellow') return '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;">🟡 ' + score + '% - check</span>';
    return '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;">🔴 not found</span>';
  }

  var counts = { already: 0, green: 0, yellow: 0, red: 0 };
  entries.forEach(function (e) { if (e.existingDoi) counts.already++; });

  // DOIs found by a completed lookup, keyed by entry id - kept separately
  // from the entries array (which never mutates) so the exporter can pick
  // up results live as the run progresses.
  var foundDoi = {};

  function bumpStats() {
    statsBox.style.display = '';
    statAlready.textContent = counts.already;
    statGreen.textContent = counts.green;
    statYellow.textContent = counts.yellow;
    statRed.textContent = counts.red;
    updateExportNote();
  }
  if (counts.already) bumpStats();

  // ---- Export: "Download Reference List" - rebuilds the full reference
  // list in original order/wording (using each entry's original inline
  // markup, not the tag-stripped search text), appending a doi.org link
  // wherever a DOI is known (typed-in originally, or found by the lookup
  // above). Entries with no DOI are left exactly as they were. ----
  var exportHtmlBtn = document.getElementById('doi-export-html-btn');
  var exportDocBtn = document.getElementById('doi-export-doc-btn');
  var exportNote = document.getElementById('doi-export-note');

  function updateExportNote() {
    if (!exportNote) return;
    var withDoi = entries.filter(function (e) { return e.existingDoi || foundDoi[e.id]; }).length;
    exportNote.textContent = withDoi + ' of ' + entries.length + ' references have a DOI - same order, same wording, DOIs appended where found.';
  }
  updateExportNote();

  function endsWithSentencePunct(cleanText) {
    return /[.?!]\\s*$/.test(String(cleanText || '').trim());
  }

  function buildReferenceListParagraphs() {
    return entries.map(function (e) {
      var doi = e.existingDoi || foundDoi[e.id] || null;
      var html = (e.rawHtml && e.rawHtml.trim()) ? e.rawHtml.trim() : esc(e.cleanText);
      if (doi && !e.existingDoi) {
        // Only append a link if the reference doesn't already contain a DOI.
        if (!endsWithSentencePunct(e.cleanText)) html += '.';
        html += ' <a href="https://doi.org/' + esc(doi) + '">https://doi.org/' + esc(doi) + '</a>';
      }
      return '<p style="margin:0 0 12pt 0;line-height:1.5;text-indent:-0.5in;margin-left:0.5in;">' + html + '</p>';
    }).join('\\n');
  }

  function downloadBlob(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  if (exportHtmlBtn) {
    exportHtmlBtn.addEventListener('click', function () {
      var body = buildReferenceListParagraphs();
      var doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reference List</title>'
        + '<style>body{font-family:"Times New Roman",Georgia,serif;font-size:12pt;max-width:800px;margin:40px auto;color:#111;}'
        + 'h1{font-size:16pt;font-family:Arial,sans-serif;}a{color:#1d4ed8;}</style>'
        + '</head><body><h1>References</h1>' + body + '</body></html>';
      downloadBlob(doc, 'Reference-List.html', 'text/html;charset=utf-8');
    });
  }

  if (exportDocBtn) {
    exportDocBtn.addEventListener('click', function () {
      var body = buildReferenceListParagraphs();
      var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
        + '<head><meta charset="utf-8"><title>Reference List</title>'
        + '<style>body{font-family:"Times New Roman",serif;font-size:12pt;}h1{font-family:Arial,sans-serif;font-size:16pt;}</style>'
        + '</head><body><h1>References</h1>' + body + '</body></html>';
      downloadBlob(doc, 'Reference-List.doc', 'application/msword');
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function cell(row, cls) { return row.querySelector(cls); }

  async function run() {
    runBtn.disabled = true;
    var email = (emailInput.value || '').trim();
    var todo = entries.filter(function (e) { return !e.existingDoi; });
    for (var i = 0; i < todo.length; i++) {
      var e = todo[i];
      var row = document.getElementById('doi-row-' + e.id);
      if (!row) continue;
      cell(row, '.doi-status-cell').innerHTML = '<span style="color:#0369a1;">🔄 checking…</span>';
      runBtn.textContent = 'Checking ' + (i + 1) + ' / ' + todo.length + '…';
      try {
        var q = encodeURIComponent(e.cleanText.slice(0, 300));
        var url = 'https://api.crossref.org/works?query.bibliographic=' + q + '&rows=3' + (email ? '&mailto=' + encodeURIComponent(email) : '');
        var res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        var items = (data.message && data.message.items) || [];
        var best = null, bestScore = -1;
        items.forEach(function (item) {
          var s = scoreItem(e, item);
          if (s > bestScore) { bestScore = s; best = item; }
        });
        if (best && bestScore > 0) {
          var tier = tierFor(bestScore);
          counts[tier]++;
          cell(row, '.doi-status-cell').innerHTML = tierBadge(tier, bestScore);
          var foundTitle = (best.title && best.title[0]) || '(untitled)';
          var foundJournal = (best['container-title'] && best['container-title'][0]) || '';
          var foundYear = (best.issued && best.issued['date-parts'] && best.issued['date-parts'][0] && best.issued['date-parts'][0][0]) || '';
          // Highlight why this was picked: the author surname wherever it
          // shows up in the matched title/journal, and the year when it
          // exactly matches this entry's year - the same signals scoreItem()
          // used to pick this result.
          var titleHtml = highlightHit(esc(foundTitle), e.surnames);
          var journalHtml = highlightHit(esc(foundJournal), e.surnames);
          var yearHtml = esc(String(foundYear));
          if (foundYear && String(foundYear) === String(e.year)) {
            yearHtml = '<mark class="doi-match-hit">' + yearHtml + '</mark>';
          }
          cell(row, '.doi-match-cell').innerHTML = '<div style="font-weight:600;">' + titleHtml + '</div><div style="color:#64748b;font-size:12px;">' + journalHtml + (foundYear ? ' · ' + yearHtml : '') + '</div>';
          var doiVal = best.DOI || '';
          if (doiVal) foundDoi[e.id] = doiVal;
          var copyLine = e.cleanText.replace(/\\s+$/, '');
          if (!/[.]\\s*$/.test(copyLine)) copyLine += '.';
          copyLine += ' https://doi.org/' + doiVal;
          cell(row, '.doi-doi-cell').innerHTML = doiVal
            ? '<span class="ctx-copy" title="Click to copy reference + DOI" data-copy="' + esc(copyLine) + '">' + esc(doiVal) + '</span>'
            : '-';
        } else {
          counts.red++;
          cell(row, '.doi-status-cell').innerHTML = tierBadge('red', 0);
          cell(row, '.doi-match-cell').innerHTML = '<span style="color:#94a3b8;">No confident Crossref match</span>';
          cell(row, '.doi-doi-cell').innerHTML = '-';
        }
      } catch (err) {
        cell(row, '.doi-status-cell').innerHTML = '<span style="color:#991b1b;">⚠ lookup failed</span>';
        cell(row, '.doi-match-cell').innerHTML = '<span style="color:#94a3b8;">' + esc(err.message || 'network error') + '</span>';
      }
      bumpStats();
      await sleep(180);
    }
    runBtn.disabled = false;
    runBtn.textContent = '✅ Done - Run Again';
    updateExportNote();
  }

  runBtn.addEventListener('click', function () { run(); });
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
  return buildReportHtml(entries.length, linkedEntries, unlinkedEntries, dupIds, orphans, entries);
}

