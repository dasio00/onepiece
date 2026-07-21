import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const WIKI_CACHE_DIR = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "techniques");
const NAMU_INDEX_PATH = path.join(ROOT, "tools", ".cache", "namu-techniques", "index.json");
const PATCH_PATH = path.join(ROOT, "tools", "technique-metadata-patches.json");
const CANDIDATE_PATH = path.join(ROOT, "tools", "technique-metadata-candidates.json");
const VALIDATION_PATH = path.join(ROOT, "tools", "technique-metadata-validation.json");
const START_MARKER = "/* TECHNIQUE_METADATA_CURATED_START */";
const END_MARKER = "/* TECHNIQUE_METADATA_CURATED_END */";
const BASE_COMMIT = "2499c1d218e46576b2dc18548956bd3483cd7fba";
const TARGET_FIELDS = ["nameKo", "nameJa", "nameEn", "reading", "sourceTitle", "sourceUrl"];
const MANUAL_WIKI_NAMES = new Map([
  ["gum-gum-pistol", "Gomu Gomu no Pistol"],
  ["oni-giri", "Oni Giri"]
]);
const MANUAL_KOREAN_NAMES = new Map([
  ["manual-tech-koby-honesty-impact", "실직(어니스티) 권골(임팩트)"]
]);
const apply = process.argv.includes("--apply");

const existingDataText = await fs.readFile(DATA_PATH, "utf8");
const dataText = stripPatchBlock(existingDataText);
const data = loadData(dataText);
const baseline = audit(data.techniques || []);
const wikiBySource = await readWikiEntries();
const namuBySource = await readNamuEntries();
const patches = {};
const evidence = {};
const candidates = [];
const directMatches = new Map();
const conflictIds = new Set();

for (const technique of data.techniques || []) {
  const wikiSource = wikiSourceForTechnique(technique);
  const wikiEntries = wikiBySource.get(wikiSource) || [];
  const manualWikiName = MANUAL_WIKI_NAMES.get(technique.id);
  let direct = matchWikiEntry(
    manualWikiName ? { ...technique, nameEn: manualWikiName } : technique,
    wikiEntries
  );

  if (technique.id === "manual-tech-koby-soru") {
    direct = {
      entry: {
        nameEn: "Soru",
        nameJa: "剃",
        reading: "Soru",
        sourceTitle: "Koby",
        sourceUrl: wikiUrl("Koby")
      },
      method: "manual-direct-reference",
      conflicts: []
    };
  }

  if (direct?.conflicts?.length) {
    conflictIds.add(technique.id);
    candidates.push(candidateRecord(technique, "wiki-identity-conflict", direct.conflicts));
    continue;
  }

  if (direct?.entry) {
    directMatches.set(technique.id, direct);
    const source = {
      sourceKind: "One Piece Wiki",
      sourceTitle: direct.entry.sourceTitle,
      sourceUrl: direct.entry.sourceUrl,
      match: direct.method
    };
    setPatchIfChanged(technique, "nameEn", direct.entry.nameEn, source);
    setPatchIfChanged(technique, "nameJa", direct.entry.nameJa, source);
    setPatchIfChanged(technique, "reading", direct.entry.reading, source);
    if (!text(technique.sourceTitle) && direct.entry.sourceTitle) {
      setPatchIfChanged(technique, "sourceTitle", direct.entry.sourceTitle, source);
    }
    if (!text(technique.sourceUrl) && direct.entry.sourceUrl) {
      setPatchIfChanged(technique, "sourceUrl", direct.entry.sourceUrl, source);
    }
  }

  const namuEntries = namuBySource.get(wikiSource) || [];
  const namuMatch = matchNamuEntry(technique, direct?.entry, namuEntries);
  const manualKoreanName = MANUAL_KOREAN_NAMES.get(technique.id);
  if (manualKoreanName) {
    setPatchIfChanged(technique, "nameKo", manualKoreanName, {
      sourceKind: "Namu Wiki",
      sourceTitle: "코비(원피스)",
      sourceUrl: namuBySource.get("Koby")?.[0]?.sourceUrl || "https://namu.wiki/w/%EC%BD%94%EB%B9%84(%EC%9B%90%ED%94%BC%EC%8A%A4)",
      match: "manual-exact-Japanese",
      crossCheckedWith: direct?.entry?.sourceUrl || wikiUrl("Koby")
    });
  }
  if (!manualKoreanName && namuMatch?.entry?.nameKo && hasHangul(namuMatch.entry.nameKo)) {
    const source = {
      sourceKind: "Namu Wiki",
      sourceTitle: namuMatch.entry.pageTitle,
      sourceUrl: namuMatch.entry.sourceUrl,
      match: namuMatch.method,
      crossCheckedWith: direct?.entry?.sourceUrl || ""
    };
    if (namuMatch.confirmed) {
      if (!text(technique.nameKo)) {
        setPatchIfChanged(technique, "nameKo", namuMatch.entry.nameKo, source);
      } else if (text(technique.nameKo) !== text(namuMatch.entry.nameKo)) {
        candidates.push(candidateRecord(technique, "existing-korean-name-differs-from-wiki", [{
          field: "nameKo",
          value: namuMatch.entry.nameKo,
          score: namuMatch.score,
          sourceTitle: namuMatch.entry.pageTitle,
          sourceUrl: namuMatch.entry.sourceUrl,
          match: namuMatch.method
        }]));
      }
    } else if (!text(technique.nameKo)) {
      candidates.push(candidateRecord(technique, "korean-name-needs-review", [{
        field: "nameKo",
        value: namuMatch.entry.nameKo,
        score: namuMatch.score,
        sourceTitle: namuMatch.entry.pageTitle,
        sourceUrl: namuMatch.entry.sourceUrl,
        match: namuMatch.method
      }]));
    }
  }
  if (!direct?.entry && !text(technique.nameEn) && namuMatch?.confirmed && namuMatch.entry.nameEn) {
    candidates.push(candidateRecord(technique, "english-name-not-on-current-one-piece-wiki", [{
      field: "nameEn",
      value: namuMatch.entry.nameEn,
      score: namuMatch.score,
      sourceTitle: namuMatch.entry.pageTitle,
      sourceUrl: namuMatch.entry.sourceUrl,
      match: namuMatch.method
    }]));
  }
}

for (const technique of data.techniques || []) {
  const resolved = { ...technique, ...(patches[technique.id] || {}) };
  const missingFields = TARGET_FIELDS.filter((field) => !text(resolved[field]));
  if (!missingFields.length || candidates.some((item) => item.id === technique.id)) continue;
  const wikiSource = wikiSourceForTechnique(technique);
  const nearWiki = nearestWikiEntries(technique, wikiBySource.get(wikiSource) || []);
  const possible = [];
  for (const entry of nearWiki) {
    for (const field of missingFields.filter((name) => ["nameJa", "nameEn", "reading"].includes(name))) {
      if (!text(entry[field])) continue;
      possible.push({
        field,
        value: entry[field],
        score: entry.score,
        sourceTitle: entry.sourceTitle,
        sourceUrl: entry.sourceUrl,
        match: "fuzzy-name-only"
      });
    }
  }
  candidates.push(candidateRecord(
    technique,
    possible.length ? "fuzzy-source-match" : "no-reliable-source-match",
    possible,
    missingFields
  ));
}

const patchDocument = {
  schemaVersion: 1,
  baseCommit: BASE_COMMIT,
  generatedAt: new Date().toISOString(),
  policy: {
    confirmed: "One Piece Wiki direct identity match, or Namu Wiki Korean label cross-checked by exact Japanese/English identity",
    candidates: "Fuzzy, ambiguous, source-only, or style-inconsistent values are not applied"
  },
  patches: sortObject(patches),
  evidence: sortObject(evidence)
};

const candidateDocument = {
  schemaVersion: 1,
  baseCommit: BASE_COMMIT,
  generatedAt: patchDocument.generatedAt,
  items: candidates.sort((a, b) => a.id.localeCompare(b.id))
};

await fs.writeFile(PATCH_PATH, `${JSON.stringify(patchDocument, null, 2)}\n`);
await fs.writeFile(CANDIDATE_PATH, `${JSON.stringify(candidateDocument, null, 2)}\n`);

if (apply) {
  await fs.writeFile(DATA_PATH, applyPatchBlock(dataText, patches));
}

const finalDataText = apply ? await fs.readFile(DATA_PATH, "utf8") : applyPatchBlock(dataText, patches);
const finalData = loadData(finalDataText);
const finalAudit = audit(finalData.techniques || []);
const validation = validate({
  baseline,
  finalAudit,
  techniques: finalData.techniques || [],
  patches,
  directMatches,
  conflictIds,
  candidates
});
await fs.writeFile(VALIDATION_PATH, `${JSON.stringify(validation, null, 2)}\n`);

console.log(JSON.stringify({
  applied: apply,
  techniques: finalAudit.total,
  patchedTechniques: Object.keys(patches).length,
  patchedFields: sum(Object.values(patches).map((item) => Object.keys(item).length)),
  candidates: candidates.length,
  before: baseline.missing,
  after: finalAudit.missing,
  validation: validation.status
}, null, 2));

function loadData(source) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: DATA_PATH });
  return context.window.onePieceData;
}

async function readWikiEntries() {
  const result = new Map();
  const files = await fs.readdir(WIKI_CACHE_DIR);
  for (const file of files.filter((name) => name.endsWith(".html"))) {
    const html = await fs.readFile(path.join(WIKI_CACHE_DIR, file), "utf8");
    const sourceTitle = sourceTitleFromWikiFile(file);
    const sourceUrl = wikiUrl(sourceTitle);
    const entries = extractWikiEntries(html).map((entry) => ({ ...entry, sourceTitle, sourceUrl }));
    result.set(sourceTitle, entries);
  }
  return result;
}

function extractWikiEntries(html) {
  const entries = [];
  const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (const item of html.matchAll(itemPattern)) {
    const bold = item[1].match(/<b\b[^>]*>([\s\S]*?)<\/b>/i);
    if (!bold) continue;
    const nameEn = cleanHtml(bold[1]);
    if (!isTechniqueName(nameEn)) continue;
    const nameJaRaw = item[1].match(/<span\b(?=[^>]*\blang=["']ja["'])[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
    const readingRaw = item[1].match(/<span\b(?=[^>]*class=["'][^"']*(?:t_|t&#95;)nihongo(?:_|&#95;)romaji[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
    entries.push({
      nameEn,
      nameJa: renderRuby(nameJaRaw),
      reading: cleanHtml(readingRaw)
    });
  }
  return uniqueBy(entries, (entry) => normalizeLatin(entry.nameEn));
}

async function readNamuEntries() {
  const index = JSON.parse(await fs.readFile(NAMU_INDEX_PATH, "utf8"));
  const result = new Map();
  for (const item of index.results || []) {
    const pages = item.matches?.length ? item.matches : item.matched ? [item.matched] : [];
    const entries = [];
    for (const page of pages) {
      if (!page?.file) continue;
      const html = await fs.readFile(path.join(ROOT, page.file), "utf8");
      entries.push(...extractNamuEntries(html).map((entry) => ({
        ...entry,
        pageTitle: page.pageTitle,
        sourceUrl: page.url
      })));
    }
    result.set(item.sourceTitle, uniqueBy(entries, (entry) => [
      normalizeLatin(entry.nameEn),
      normalizeJapanese(entry.nameJa),
      normalizeKorean(entry.nameKo)
    ].join("|")));
  }
  return result;
}

function extractNamuEntries(html) {
  const entries = [];
  for (const match of html.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)) {
    const parsed = parseNamuStrong(match[1]);
    if (parsed && (parsed.nameEn || parsed.nameJa) && parsed.nameKo) entries.push(parsed);
  }
  return uniqueBy(entries, (entry) => [
    normalizeLatin(entry.nameEn),
    normalizeJapanese(entry.nameJa),
    normalizeKorean(entry.nameKo)
  ].join("|"));
}

function parseNamuStrong(raw) {
  const rubies = [];
  let tokenized = String(raw).replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi, (_, inner) => {
    const surface = cleanHtml(inner.replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, " ").replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, " "));
    const reading = cleanHtml(inner.match(/<rt\b[^>]*>([\s\S]*?)<\/rt>/i)?.[1] || "");
    const token = `@@RUBY${rubies.length}@@`;
    rubies.push({ token, surface, reading });
    return token;
  });
  tokenized = cleanHtml(tokenized);
  const expanded = rubies.reduce(
    (value, ruby) => value.replaceAll(ruby.token, `${ruby.surface}${ruby.reading ? ` (${ruby.reading})` : ""}`),
    tokenized
  );
  if (expanded.length > 180) return null;

  const parts = expanded.split(/\s*\/\s*/).map(cleanEdge).filter(Boolean);
  const englishPart = [...parts].reverse().find((part) => hasLatin(part) && part.length < 120) || "";
  const japaneseRubies = rubies.filter((ruby) => (
    hasJapanese(ruby.surface)
    || (hasJapanese(ruby.reading) && !hasHangul(ruby.surface))
  ));
  let nameJa = japaneseRubies.map((ruby) => `${ruby.surface}${ruby.reading ? ` (${ruby.reading})` : ""}`).join(" ").trim();
  if (!nameJa && parts.length >= 3) nameJa = parts[parts.length - 2];
  if (!nameJa && parts.length >= 2) {
    const japaneseSuffix = parts[0].match(/\(([^()]*(?:[ぁ-んァ-ヶ一-龯々〆ヵヶ])[^()]*)$/);
    nameJa = japaneseSuffix?.[1] || "";
  }
  if (!nameJa) {
    const parenthetical = expanded.match(/\(([^()]*(?:[ぁ-んァ-ヶ一-龯々〆ヵヶ])[^()]*)\)/);
    nameJa = parenthetical?.[1] || "";
  }

  let nameKo = "";
  const firstJapaneseToken = japaneseRubies[0]?.token;
  if (firstJapaneseToken && tokenized.includes(firstJapaneseToken)) {
    nameKo = cleanEdge(tokenized.slice(0, tokenized.indexOf(firstJapaneseToken)));
    nameKo = rubies.reduce(
      (value, ruby) => value.replaceAll(ruby.token, `${ruby.surface}${ruby.reading ? ` (${ruby.reading})` : ""}`),
      nameKo
    );
  } else if (parts.length >= 2) {
    nameKo = parts[0];
  }
  nameKo = nameKo
    .replace(/\(\s*[^()]*[ぁ-んァ-ヶ一-龯々〆ヵヶ][^()]*$/, "")
    .replace(/\(\s*$/, "");
  nameKo = cleanEdge(nameKo);
  nameKo = nameKo.replace(/^['"“”‘’]+|['"“”‘’]+$/g, "").trim();
  if (!hasHangul(nameKo) || nameKo.length > 100) return null;
  return {
    nameKo,
    nameJa: cleanEdge(nameJa),
    nameEn: cleanEdge(englishPart),
    kanaReading: japaneseRubies.map((ruby) => ruby.reading).filter(Boolean).join(" ")
  };
}

function matchWikiEntry(technique, entries) {
  if (!entries.length) return null;
  const currentEn = text(technique.nameEn) || (hasLatin(technique.name) && !hasHangul(technique.name) ? text(technique.name) : "");
  const currentJa = text(technique.nameJa) || text(technique.originalNotation);
  const exactEn = currentEn
    ? entries.filter((entry) => normalizeLatin(entry.nameEn) === normalizeLatin(currentEn))
    : [];
  const exactJa = currentJa
    ? entries.filter((entry) => normalizeJapanese(entry.nameJa) === normalizeJapanese(currentJa))
    : [];
  const exactId = entries.filter((entry) => `wiki-tech-${slugify(entry.nameEn)}` === technique.id);
  const selected = uniqueBy([...exactEn, ...exactJa, ...exactId], (entry) => normalizeLatin(entry.nameEn));
  if (selected.length === 1) {
    const method = exactEn.includes(selected[0])
      ? "exact-English"
      : exactJa.includes(selected[0])
        ? "exact-Japanese"
        : "exact-generated-id";
    return { entry: selected[0], method, conflicts: [] };
  }
  if (selected.length > 1) {
    return {
      entry: null,
      method: "conflict",
      conflicts: selected.map((entry) => sourceCandidate(entry, "identity"))
    };
  }
  return null;
}

function matchNamuEntry(technique, wikiEntry, entries) {
  if (!entries.length) return null;
  const en = text(wikiEntry?.nameEn) || text(technique.nameEn);
  const ja = text(wikiEntry?.nameJa) || text(technique.nameJa);
  const scored = entries.map((entry) => {
    const englishExact = en && entry.nameEn && normalizeLatin(en) === normalizeLatin(entry.nameEn);
    const japaneseExact = ja && entry.nameJa && normalizeJapanese(ja) === normalizeJapanese(entry.nameJa);
    const japaneseBaseExact = ja
      && entry.nameJa
      && normalizeJapaneseBase(ja).length >= 2
      && normalizeJapaneseBase(ja) === normalizeJapaneseBase(entry.nameJa);
    const koreanExact = technique.nameKo && normalizeKorean(technique.nameKo) === normalizeKorean(entry.nameKo);
    const score = (japaneseExact ? 5 : japaneseBaseExact ? 4 : 0) + (englishExact ? 3 : 0) + (koreanExact ? 1 : 0);
    return {
      entry,
      score,
      method: [
        japaneseExact ? "exact-Japanese" : japaneseBaseExact ? "exact-Japanese-base" : "",
        englishExact ? "exact-English" : "",
        koreanExact ? "exact-Korean" : ""
      ]
        .filter(Boolean)
        .join("+")
    };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const top = scored[0];
  const tied = scored.filter((item) => item.score === top.score);
  return {
    ...top,
    confirmed: tied.length === 1 && (top.score >= 4 || (top.score >= 3 && Boolean(wikiEntry)))
  };
}

function nearestWikiEntries(technique, entries) {
  const query = normalizeLatin(technique.nameEn || technique.name || "");
  if (!query) return [];
  return entries
    .map((entry) => ({ ...entry, score: similarity(query, normalizeLatin(entry.nameEn)) }))
    .filter((entry) => entry.score >= 0.72)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function setPatchIfChanged(technique, field, value, source) {
  const next = text(value);
  if (!next || text(technique[field]) === next) return;
  patches[technique.id] ||= {};
  evidence[technique.id] ||= {};
  patches[technique.id][field] = next;
  evidence[technique.id][field] = {
    previous: text(technique[field]),
    value: next,
    ...source
  };
}

function candidateRecord(technique, reason, possibleValues = [], missingFields = null) {
  const patched = patches[technique.id] || {};
  return {
    id: technique.id,
    ownerId: technique.ownerId || technique.user || "",
    current: Object.fromEntries(TARGET_FIELDS.map((field) => [field, text(technique[field])])),
    unresolvedFields: missingFields || TARGET_FIELDS.filter((field) => !text(patched[field] || technique[field])),
    reason,
    possibleValues
  };
}

function applyPatchBlock(source, patchMap) {
  const body = `
${START_MARKER}
(() => {
  const patches = ${JSON.stringify(sortObject(patchMap), null, 2)};
  const techniquesById = new Map((window.onePieceData.techniques || []).map((technique) => [technique.id, technique]));
  Object.entries(patches).forEach(([id, patch]) => {
    const technique = techniquesById.get(id);
    if (technique) Object.assign(technique, patch);
  });
})();
${END_MARKER}
`;
  const block = new RegExp(`\\n?${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`);
  if (block.test(source)) return source.replace(block, `\n${body}`);
  return `${source.trimEnd()}\n${body}`;
}

function stripPatchBlock(source) {
  const block = new RegExp(`\\n?${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`);
  return String(source || "").replace(block, "\n").trimEnd() + "\n";
}

function audit(techniques) {
  return {
    total: techniques.length,
    complete: techniques.filter((item) => TARGET_FIELDS.every((field) => text(item[field]))).length,
    missing: Object.fromEntries(TARGET_FIELDS.map((field) => [
      field,
      techniques.filter((item) => !text(item[field])).length
    ]))
  };
}

function validate({ baseline, finalAudit, techniques, patches: patchMap, directMatches: matches, conflictIds: conflicts, candidates: candidateItems }) {
  const ids = techniques.map((item) => item.id);
  const invalidUrls = techniques
    .filter((item) => item.sourceUrl && !/^https:\/\//.test(item.sourceUrl))
    .map((item) => item.id);
  const missingPatchedValues = [];
  const byId = new Map(techniques.map((item) => [item.id, item]));
  for (const [id, patch] of Object.entries(patchMap)) {
    for (const [field, value] of Object.entries(patch)) {
      if (text(byId.get(id)?.[field]) !== text(value)) missingPatchedValues.push({ id, field, expected: value, actual: byId.get(id)?.[field] || "" });
    }
  }
  const directSourceMismatches = [];
  const unbalancedPatchedValues = [];
  for (const [id, patch] of Object.entries(patchMap)) {
    for (const [field, value] of Object.entries(patch)) {
      if (countCharacter(value, "(") !== countCharacter(value, ")")) {
        unbalancedPatchedValues.push({ id, field, value });
      }
    }
  }
  for (const [id, match] of matches) {
    const technique = byId.get(id);
    if (!technique || !match.entry) continue;
    for (const field of ["nameEn", "nameJa", "reading"]) {
      if (!match.entry[field]) continue;
      if (text(technique[field]) !== text(match.entry[field])) {
        directSourceMismatches.push({ id, field, expected: match.entry[field], actual: text(technique[field]) });
      }
    }
  }
  const checks = {
    dataLoads: Boolean(techniques.length),
    uniqueIds: new Set(ids).size === ids.length,
    httpsSourceUrls: invalidUrls.length === 0,
    allPatchValuesApplied: missingPatchedValues.length === 0,
    balancedPatchValues: unbalancedPatchedValues.length === 0,
    directSourceValuesMatch: directSourceMismatches.length === 0,
    noIdentityConflictsApplied: [...conflicts].every((id) => !patchMap[id])
  };
  return {
    generatedAt: new Date().toISOString(),
    baseCommit: BASE_COMMIT,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    checks,
    summary: {
      baseline,
      final: finalAudit,
      patchedTechniques: Object.keys(patchMap).length,
      patchedFields: sum(Object.values(patchMap).map((item) => Object.keys(item).length)),
      directWikiMatches: matches.size,
      identityConflicts: conflicts.size,
      candidateRecords: candidateItems.length
    },
    failures: {
      invalidUrls,
      missingPatchedValues,
      unbalancedPatchedValues,
      directSourceMismatches,
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index)
    }
  };
}

function wikiSourceForTechnique(technique) {
  if (technique.id === "gum-gum-pistol") return "Gomu Gomu no Mi/Techniques";
  if (technique.id === "oni-giri") return "Three Sword Style";
  if (technique.id.startsWith("namu-luffy-")) return "Gomu Gomu no Mi/Techniques";
  if (technique.id.startsWith("manual-tech-koby-")) return "Koby";
  return technique.sourceTitle || "";
}

function sourceTitleFromWikiFile(file) {
  const title = file.replace(/\.html$/i, "").replace(/_/g, " ");
  if (title === "Gomu Gomu no Mi Techniques") return "Gomu Gomu no Mi/Techniques";
  if (title === "Tori Tori no Mi Model Phoenix") return "Tori Tori no Mi, Model: Phoenix";
  if (title === "Uo Uo no Mi Model Seiryu") return "Uo Uo no Mi, Model: Seiryu";
  return title;
}

function renderRuby(html) {
  if (!html) return "";
  const rendered = String(html)
    .replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi, (_, inner) => {
      const base = cleanHtml(inner.replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, " ").replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, " "));
      const reading = cleanHtml(inner.match(/<rt\b[^>]*>([\s\S]*?)<\/rt>/i)?.[1] || "");
      return `${base}${reading ? ` (${reading})` : ""}`;
    });
  return cleanHtml(rendered);
}

function cleanHtml(value) {
  return cleanEdge(decodeHtml(String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")));
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(x?[0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function sourceCandidate(entry, field) {
  return {
    field,
    value: entry.nameEn,
    sourceTitle: entry.sourceTitle,
    sourceUrl: entry.sourceUrl,
    nameJa: entry.nameJa,
    reading: entry.reading
  };
}

function wikiUrl(title) {
  return `https://onepiece.fandom.com/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeLatin(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeJapanese(value) {
  return [...String(value || "").normalize("NFKC")]
    .filter((character) => /[ぁ-んァ-ヶ一-龯々〆ヵヶA-Za-z0-9]/.test(character))
    .join("")
    .toLowerCase();
}

function normalizeJapaneseBase(value) {
  return normalizeJapanese(String(value || "").replace(/[（(][^()（）]*[)）]/g, ""));
}

function normalizeKorean(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^가-힣a-z0-9]+/g, "");
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function cleanEdge(value) {
  let cleaned = String(value || "")
    .replace(/^[\s[\]{}]+|[\s[\]{}:;,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  while (cleaned.endsWith(")") && countCharacter(cleaned, ")") > countCharacter(cleaned, "(")) {
    cleaned = cleaned.slice(0, -1).trimEnd();
  }
  while (cleaned.startsWith("(") && countCharacter(cleaned, "(") > countCharacter(cleaned, ")")) {
    cleaned = cleaned.slice(1).trimStart();
  }
  return cleaned;
}

function countCharacter(value, character) {
  return [...String(value || "")].filter((item) => item === character).length;
}

function text(value) {
  return String(value || "").trim();
}

function hasLatin(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function hasHangul(value) {
  return /[가-힣]/.test(String(value || ""));
}

function hasJapanese(value) {
  return /[ぁ-んァ-ヶ一-龯々〆ヵヶ]/.test(String(value || ""));
}

function isTechniqueName(value) {
  const textValue = text(value);
  return Boolean(textValue) && textValue.length < 120 && !/[.:[\]]/.test(textValue);
}

function uniqueBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const itemKey = key(item);
    if (itemKey && !map.has(itemKey)) map.set(itemKey, item);
  }
  return [...map.values()];
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
