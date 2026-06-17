import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const WT100_HTML_PATH = path.join(ROOT, "wt100.html");
const CACHE_DIR = path.join(ROOT, "tools", ".cache");
const WIKI_CACHE_DIR = path.join(CACHE_DIR, "onepiece-wiki", "pages");
const WT100_MASTER_CACHE = path.join(CACHE_DIR, "wt100-master.json");
const WT100_OPTIONS_CACHE = path.join(CACHE_DIR, "wt100-options.json");
const OUTPUT_PATH = path.join(ROOT, "tools", "wiki-enrichment-output.json");
const API = "https://onepiece.fandom.com/api.php";
const WT100_MASTER_URL = "https://onepiecewt100-2026.com/static/data/master.bin?v=5f2eb04806a463de4f4869e4b430ad2d";
const WT100_KEY = "aesup66snwcdmsrnsw7d7zywyw3y243aesdcw3wsiy7whixr296pmu7m75p7ptuw";
const START_MARKER = "/* WIKI_AUTO_ENRICH_START */";
const END_MARKER = "/* WIKI_AUTO_ENRICH_END */";

const KO = {
  current: "\uD604\uC7AC",
  sourceNote: "\uACF5\uC2DD WT100 \uB4F1\uC7A5\uD3B8",
  autoInfo: "One Piece Wiki infobox \uAE30\uC900 \uC790\uB3D9 \uBCF4\uAC15 \uC815\uBCF4\uC785\uB2C8\uB2E4.",
  arcNames: [
    "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 \uD3B8",
    "\uC54C\uB77C\uBC14\uC2A4\uD0C0 \uD3B8",
    "\uD558\uB298\uC12C \uD3B8",
    "\uB370\uBE44 \uBC31 \uD30C\uC774\uD2B8 \uD3B8",
    "\uC6CC\uD130\uC138\uBE10 \uD3B8",
    "\uC5D0\uB2C8\uC5D0\uC2A4 \uB85C\uBE44 \uD3B8",
    "\uC2A4\uB9B4\uB7EC \uBC14\uD06C \uD3B8",
    "\uC0E4\uBCF8\uB514 \uC81C\uB3C4 \uD3B8",
    "\uC5EC\uAC1C\uC12C \uC544\uB9C8\uC874 \uB9B4\uB9AC \uD3B8",
    "\uC784\uD3A0 \uB2E4\uC6B4 \uD3B8",
    "\uB9C8\uB9B0\uD3EC\uB4DC \uC815\uC0C1\uC804\uC7C1 \uD3B8",
    "\uC5B4\uC778\uC12C \uD3B8",
    "\uD38C\uD06C \uD558\uC790\uB4DC \uD3B8",
    "\uB4DC\uB808\uC2A4\uB85C\uC790 \uD3B8",
    "\uC870 \uD3B8",
    "\uD640\uCF00\uC774\uD06C \uC544\uC77C\uB79C\uB4DC \uD3B8",
    "\uC138\uACC4\uD68C\uC758 \uD3B8",
    "\uC640\uB178\uAD6D \uD3B8",
    "\uC5D0\uADF8\uD5E4\uB4DC \uD3B8",
    "\uC5D8\uBC14\uD504 \uD3B8",
    "\uACE0\uB4DC\uBC38\uB9AC \uD3B8",
    "\uD45C\uC9C0 \uC5F0\uC7AC",
    "\uAE30\uD0C0"
  ]
};

const ARC_SLUGS = [
  "east-blue-saga",
  "alabasta",
  "skypiea",
  "davy-back-fight",
  "water-seven",
  "enies-lobby",
  "thriller-bark",
  "sabaody",
  "amazon-lily",
  "impel-down",
  "marineford-war",
  "fish-man-island",
  "punk-hazard",
  "dressrosa",
  "zou",
  "whole-cake-island",
  "reverie",
  "wano",
  "egghead",
  "elbaf",
  "god-valley",
  "cover-stories",
  "other"
];

const COMMON_ORG_IDS = new Map([
  [204, "red-hair"],
  [271, "straw-hat"]
]);
const resolvedTitleCache = new Map();
const searchResultCache = new Map();

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const apply = args.get("apply") === "true";
const skipWiki = args.get("skip-wiki") === "true";
const detailLimit = args.get("all") === "true" ? Number.POSITIVE_INFINITY : Number(args.get("limit") || 50);
const applyOutput = args.get("apply-output") === "true";

await fs.mkdir(WIKI_CACHE_DIR, { recursive: true });
await fs.mkdir(CACHE_DIR, { recursive: true });

const dataText = await fs.readFile(DATA_PATH, "utf8");
const data = loadData(dataText);
const wt100Characters = await getWt100Master();
const wt100Options = await getWt100Options();
const wt100ByFaceId = new Map(wt100Characters.map((character) => [character.id, character]));
const officialOrgById = new Map(wt100Options.organizations.map((org) => [org.id, org]));

if (applyOutput) {
  const previous = JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
  const nextText = applyEnrichmentBlock(dataText, {
    officialEntries: previous.officialEntries || [],
    wikiEntries: previous.wikiEntries || [],
    subOrganizations: buildSubOrganizationEntries(wt100Options.organizations),
    fruitEntries: previous.fruitEntries || []
  });
  await fs.writeFile(DATA_PATH, nextText);
  console.log(JSON.stringify({
    appliedOutput: true,
    officialEntries: previous.officialEntries?.length || 0,
    wikiEntries: previous.wikiEntries?.length || 0,
    fruits: previous.fruitEntries?.length || 0
  }, null, 2));
  process.exit(0);
}

const people = data.people
  .filter((person) => /^wt100-\d+$/.test(person.id))
  .sort((a, b) => Number(a.id.replace("wt100-", "")) - Number(b.id.replace("wt100-", "")));

const officialEntries = [];
const wikiEntries = [];
const fruitEntries = new Map();
const unmatched = [];

for (const person of people) {
  const faceId = faceIdFromPerson(person);
  const official = wt100ByFaceId.get(faceId);
  if (!official) continue;
  officialEntries.push({
    id: person.id,
    faceId,
    sourceNameJa: official.name?.ja || person.name,
    sourceNameEn: normalizeOfficialEnglishName(official.name?.en || ""),
    patch: buildOfficialPatch(official, wt100Options)
  });
}

if (!skipWiki) {
  for (const entry of officialEntries.slice(0, detailLimit)) {
    const person = data.people.find((item) => item.id === entry.id);
    const wiki = await findWikiPageForOfficialCharacter(entry, person);
    if (!wiki) {
      unmatched.push({ id: entry.id, sourceNameJa: entry.sourceNameJa, sourceNameEn: entry.sourceNameEn });
      continue;
    }
    const patch = buildWikiPatch(wiki.info);
    const fruitPatches = buildFruitPatches(entry.id, wiki.info);
    if (fruitPatches.length) {
      patch.devilFruitId = fruitPatches[0].id;
      fruitPatches.forEach((fruitPatch) => fruitEntries.set(fruitPatch.id, fruitPatch));
    }
    wikiEntries.push({
      id: entry.id,
      sourceNameJa: entry.sourceNameJa,
      sourceNameEn: entry.sourceNameEn,
      wikiTitle: wiki.title,
      wikiUrl: wikiUrl(wiki.title),
      patch
    });
    await sleep(40);
  }
}

const subOrganizations = buildSubOrganizationEntries(wt100Options.organizations);
const output = {
  generatedAt: new Date().toISOString(),
  officialMatched: officialEntries.length,
  wikiTried: skipWiki ? 0 : Math.min(officialEntries.length, Number.isFinite(detailLimit) ? detailLimit : officialEntries.length),
  wikiMatched: wikiEntries.length,
  unmatched,
  subOrganizations: subOrganizations.length,
  fruits: fruitEntries.size,
  officialEntries,
  wikiEntries,
  fruitEntries: [...fruitEntries.values()]
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

if (apply) {
  const nextText = applyEnrichmentBlock(dataText, {
    officialEntries,
    wikiEntries,
    subOrganizations,
    fruitEntries: [...fruitEntries.values()]
  });
  await fs.writeFile(DATA_PATH, nextText);
}

console.log(JSON.stringify({
  officialMatched: officialEntries.length,
  wikiTried: output.wikiTried,
  wikiMatched: wikiEntries.length,
  fruits: fruitEntries.size,
  subOrganizations: subOrganizations.length,
  output: path.relative(ROOT, OUTPUT_PATH),
  applied: apply
}, null, 2));

function loadData(text) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(text, context, { filename: "data.js" });
  return context.window.onePieceData;
}

async function getWt100Master() {
  try {
    return JSON.parse(await fs.readFile(WT100_MASTER_CACHE, "utf8"));
  } catch {
    const res = await fetch(WT100_MASTER_URL);
    if (!res.ok) throw new Error(`WT100 master request failed ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const key = new TextEncoder().encode(WT100_KEY);
    const decoded = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      decoded[index] = bytes[index] ^ key[index % key.length];
    }
    const json = new TextDecoder().decode(decoded);
    await fs.writeFile(WT100_MASTER_CACHE, json);
    return JSON.parse(json);
  }
}

async function getWt100Options() {
  try {
    return JSON.parse(await fs.readFile(WT100_OPTIONS_CACHE, "utf8"));
  } catch {
    const html = await fs.readFile(WT100_HTML_PATH, "utf8");
    const options = parseWt100Options(html);
    await fs.writeFile(WT100_OPTIONS_CACHE, `${JSON.stringify(options, null, 2)}\n`);
    return options;
  }
}

function parseWt100Options(html) {
  const arcSelect = html.match(/<select[\s\S]*?data-vote-attribute-arc[\s\S]*?<\/select>/)?.[0] || "";
  const factionSelect = html.match(/<select[\s\S]*?data-vote-attribute-faction[\s\S]*?<\/select>/)?.[0] || "";
  const organizationSelects = [...html.matchAll(/<select[\s\S]*?data-group="(\d+)"[\s\S]*?data-vote-attribute-organization[\s\S]*?<\/select>/g)];
  return {
    arcs: parseOptions(arcSelect).map((item, index) => ({
      ...item,
      slug: ARC_SLUGS[index] || `wt-arc-${item.id}`,
      nameKo: KO.arcNames[index] || item.name
    })),
    factions: parseOptions(factionSelect),
    organizations: organizationSelects.flatMap((selectMatch) => {
      const group = Number(selectMatch[1]);
      return parseOptions(selectMatch[0]).map((item) => ({ ...item, group }));
    })
  };
}

function parseOptions(selectHtml) {
  return [...selectHtml.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map((match) => ({ id: Number(match[1]), name: cleanHtml(match[2]) }))
    .filter((option) => Number.isFinite(option.id) && option.id > 0);
}

function buildOfficialPatch(character, options) {
  const arcById = new Map(options.arcs.map((arc) => [arc.id, arc]));
  const arcIds = (character.arc || []).map((id) => arcById.get(id)?.slug || `wt-arc-${id}`);
  const arcLabels = (character.arc || []).map((id) => arcById.get(id)?.nameKo || arcById.get(id)?.name).filter(Boolean);
  const faction = (character.factions || [])[0];
  const organization = mapFactionToOrganization(faction);
  const primaryOrgId = (character.orgs || [])[0];
  const patch = {
    sourceFaceId: character.id,
    sourceNameJa: character.name?.ja || "",
    sourceNameEn: normalizeOfficialEnglishName(character.name?.en || ""),
    sourceSearch: (character.search || []).slice(0, 32),
    appearanceArcIds: arcIds
  };
  if (arcLabels.length) patch.note = `${KO.sourceNote}: ${arcLabels.join(", ")}`;
  if (organization) patch.organization = organization;
  if (primaryOrgId) patch.subOrganization = officialOrgIdToLocalId(primaryOrgId);
  return patch;
}

function buildSubOrganizationEntries(organizations) {
  return organizations.map((org) => ({
    id: officialOrgIdToLocalId(org.id),
    organizationId: mapFactionToOrganization(org.group) || "etc",
    name: org.name,
    sourceId: org.id,
    sourceGroup: org.group,
    description: ""
  }));
}

async function findWikiPageForOfficialCharacter(entry, person) {
  if (person?.wikiTitle) {
    try {
      const info = await getPageInfo(person.wikiTitle);
      if (isCharacterPageMatch(entry, info)) return { title: person.wikiTitle, info };
    } catch {
      // Fall back to the normal candidate search if a saved title no longer resolves.
    }
  }
  const directCandidates = unique([
    stripParenthetical(entry.sourceNameEn),
    titleCase(stripParenthetical(entry.sourceNameEn)),
    entry.sourceNameEn,
    titleCase(entry.sourceNameEn),
    person?.name
  ].filter(Boolean));
  const searchedCandidates = [];
  for (const candidate of directCandidates) {
    const pageTitle = await resolvePageTitle(candidate);
    if (pageTitle) searchedCandidates.push(pageTitle);
  }
  if (searchedCandidates.length < 4 && entry.sourceNameEn) {
    const searchResults = await searchWiki(entry.sourceNameEn);
    searchedCandidates.push(...searchResults.slice(0, 5));
  }
  for (const title of unique(searchedCandidates)) {
    try {
      const info = await getPageInfo(title);
      if (isCharacterPageMatch(entry, info)) return { title, info };
    } catch {
      // Some WT100 English labels include aliases that do not map to real wiki pages.
      // Keep trying the next candidate instead of stopping the whole batch.
    }
  }
  return null;
}

async function resolvePageTitle(title) {
  if (resolvedTitleCache.has(title)) return resolvedTitleCache.get(title);
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url);
  if (!res.ok) return "";
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {});
  const page = pages.find((item) => !item.missing);
  const resolved = page?.title || "";
  resolvedTitleCache.set(title, resolved);
  return resolved;
}

async function searchWiki(query) {
  if (searchResultCache.has(query)) return searchResultCache.get(query);
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "8");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const results = (json.query?.search || []).map((item) => item.title);
  searchResultCache.set(query, results);
  return results;
}

async function getPageInfo(title) {
  const cachePath = path.join(WIKI_CACHE_DIR, `${safeName(title)}.json`);
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    const html = await fetchWikiParse(title, "text");
    const fieldValues = extractInfoboxFieldValues(html);
    const firstFields = {};
    for (const [label, values] of Object.entries(fieldValues)) firstFields[label] = values[0] || "";
    const info = {
      title,
      japaneseNames: splitJapaneseNames(firstFieldByPrefix(firstFields, "Japanese Name")),
      fields: firstFields,
      fieldValues
    };
    await fs.writeFile(cachePath, `${JSON.stringify(info, null, 2)}\n`);
    return info;
  }
}

async function fetchWikiParse(page, prop) {
  const url = new URL(API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", prop);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiki request failed ${res.status}: ${page}`);
  const json = await res.json();
  if (json.error) throw new Error(`Wiki parse error ${page}: ${json.error.info}`);
  return prop === "text" ? json.parse.text["*"] : json.parse.wikitext["*"];
}

function extractInfoboxFieldValues(html) {
  const fields = {};
  const pattern = /<h3[^>]*class="pi-data-label[^"]*"[^>]*>(.*?)<\/h3>\s*<div[^>]*class="pi-data-value[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  for (const match of html.matchAll(pattern)) {
    const label = cleanHtml(match[1]);
    const value = cleanHtml(match[2]);
    if (!fields[label]) fields[label] = [];
    fields[label].push(value);
  }
  return fields;
}

function buildWikiPatch(info) {
  const fields = info.fields;
  const age = lastNumber(firstFieldByPrefix(fields, "Age"));
  const heightCm = maxCm(firstFieldByPrefix(fields, "Height"));
  const bounty = firstBounty(firstFieldByPrefix(fields, "Bounty"));
  const birthday = parseEnglishBirthday(firstFieldByPrefix(fields, "Birthday"));
  const aliases = firstFieldByPrefix(fields, "Epithet") || firstFieldByPrefix(fields, "Alias");
  const hasPersonStats = Boolean(
    age ||
    birthday ||
    bounty ||
    firstFieldByPrefix(fields, "Blood Type") ||
    firstFieldByPrefix(fields, "Occupations") ||
    firstFieldByPrefix(fields, "Origin")
  );
  const patch = {
    wikiTitle: info.title,
    wikiUrl: wikiUrl(info.title)
  };
  if (aliases) patch.aliases = compactValue(aliases);
  if (firstFieldByPrefix(fields, "Occupations")) patch.job = compactValue(firstFieldByPrefix(fields, "Occupations"));
  if (age) patch.age = age;
  if (birthday) patch.birthday = birthday;
  if (heightCm && hasPersonStats) {
    patch.heightCm = heightCm;
    patch.heightHistory = [{ period: KO.current, cm: heightCm }];
  }
  if (bounty) {
    patch.bounty = bounty;
    patch.bountyHistory = [{ period: KO.current, amount: bounty }];
  }
  if (firstFieldByPrefix(fields, "Blood Type")) patch.bloodType = compactValue(firstFieldByPrefix(fields, "Blood Type"));
  Object.assign(patch, mapOrigin(firstFieldByPrefix(fields, "Origin")));
  Object.assign(patch, mapOrganization(firstFieldByPrefix(fields, "Affiliations")));
  if (firstFieldByPrefix(fields, "Occupations") || firstFieldByPrefix(fields, "Affiliations")) {
    patch.description = `${info.title} - ${KO.autoInfo}`;
  }
  return patch;
}

function buildFruitPatches(personId, info) {
  const values = info.fieldValues || {};
  const typeValues = Object.entries(values)
    .filter(([label]) => /^Type\s*:?\s*$/i.test(label))
    .flatMap(([, fieldValues]) => fieldValues);
  const englishNames = Object.entries(values)
    .filter(([label]) => /^English Name\s*:?\s*$/i.test(label))
    .flatMap(([, fieldValues]) => fieldValues);
  return englishNames
    .map((rawName, index) => {
      const fruitTypeValue = typeValues[index] || typeValues.find((value) => /Paramecia|Zoan|Logia/i.test(value)) || "";
      if (!rawName || !/Paramecia|Zoan|Logia/i.test(fruitTypeValue)) return null;
      const name = rawName.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
      const id = /Gum-Gum/i.test(rawName) ? "gum-gum" : slugify(name || rawName);
      return {
        id,
        name,
        type: mapFruitType(fruitTypeValue),
        zoanSubtype: /Mythical/i.test(fruitTypeValue) ? "mythical" : (/Ancient/i.test(fruitTypeValue) ? "ancient" : ""),
        model: modelFromFruitName(rawName),
        awakened: false,
        currentUserId: personId,
        previousUserIds: [],
        description: `${rawName} - ${KO.autoInfo}`
      };
    })
    .filter(Boolean);
}

function applyEnrichmentBlock(text, payload) {
  const serializable = JSON.stringify(payload, null, 2);
  const body = `
${START_MARKER}
(() => {
  const data = window.onePieceData;
  const payload = ${serializable};
  const blank = (value) => value === undefined || value === null || value === "" || value === 0 || (Array.isArray(value) && value.length === 0);
  const fill = (target, key, value) => {
    if (value === undefined || value === null) return;
    const always = new Set(["sourceFaceId", "sourceNameJa", "sourceNameEn", "sourceSearch", "appearanceArcIds", "wikiTitle", "wikiUrl"]);
    if (always.has(key) || blank(target[key]) || (key === "organization" && target[key] === "etc")) target[key] = value;
  };
  const fillPerson = (id, patch) => {
    const person = data.people.find((item) => item.id === id);
    if (!person) return;
    Object.entries(patch).forEach(([key, value]) => fill(person, key, value));
  };
  const upsert = (list, id, next) => {
    const item = list.find((entry) => entry.id === id);
    if (item) Object.assign(item, { ...next, ...item });
    else list.push(next);
  };

  data.people = data.people.filter((person) => !String(person.id || "").startsWith("wt100-") || String(person.imageUrl || "").includes("/assets/faces/"));
  payload.subOrganizations.forEach((item) => upsert(data.subOrganizations, item.id, item));
  payload.fruitEntries.forEach((item) => upsert(data.devilFruits, item.id, item));
  payload.officialEntries.forEach((entry) => fillPerson(entry.id, entry.patch));
  payload.wikiEntries.forEach((entry) => fillPerson(entry.id, entry.patch));
})();
${END_MARKER}
`;
  const blockPattern = new RegExp(`\\n?${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`);
  if (blockPattern.test(text)) return text.replace(blockPattern, `\n${body}`);
  return `${text.trimEnd()}\n${body}`;
}

function isCharacterPageMatch(entry, info) {
  const expectedJa = normalizeJapanese(entry.sourceNameJa);
  const expectedEn = normalizeName(entry.sourceNameEn);
  const officialEn = normalizeName(firstFieldByPrefix(info.fields, "Official English Name"));
  const title = normalizeName(info.title);
  const jaMatches = info.japaneseNames.some((name) => normalizeJapanese(name) === expectedJa);
  const enMatches = officialEn && (officialEn === expectedEn || expectedEn.includes(officialEn) || officialEn.includes(expectedEn));
  const titleMatches = title && (title === expectedEn || expectedEn.includes(title) || title.includes(expectedEn));
  return jaMatches || enMatches || (titleMatches && expectedEn.length > 4);
}

function firstFieldByPrefix(fields, prefix) {
  const entry = Object.entries(fields || {}).find(([label]) => normalizeLabel(label).startsWith(normalizeLabel(prefix)));
  return entry?.[1] || "";
}

function normalizeLabel(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeOfficialEnglishName(value) {
  return titleCase(value.replace(/\s+/g, " ").trim());
}

function titleCase(value) {
  return String(value || "").toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bD\.\b/g, "D.")
    .replace(/\bCp\b/g, "CP")
    .replace(/\bMads\b/g, "MADS");
}

function stripParenthetical(value) {
  return String(value || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function cleanHtml(html) {
  return String(html || "")
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/<ruby[^>]*>/g, "")
    .replace(/<\/ruby>/g, "")
    .replace(/<rt[\s\S]*?<\/rt>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJapanese(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[・.\s\-]/g, "")
    .replace(/[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9]/gu, "")
    .toLowerCase();
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function splitJapaneseNames(value) {
  const clean = String(value || "").replace(/\s*\[[^\]]+\]/g, "");
  return unique(clean.split(/;|,| \/ |\n/).map((part) => part.trim()).filter(Boolean).concat(clean.trim() ? [clean.trim()] : []));
}

function compactValue(value) {
  return String(value || "").replace(/\s*\[[^\]]+\]/g, "").split(";")[0].trim();
}

function lastNumber(value) {
  const matches = [...String(value || "").matchAll(/\b(\d{1,4})\b/g)].map((match) => Number(match[1]));
  return matches.length ? matches[matches.length - 1] : 0;
}

function maxCm(value) {
  const matches = [...String(value || "").matchAll(/(\d{2,4})\s*cm/g)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : 0;
}

function firstBounty(value) {
  const match = String(value || "").replaceAll(",", "").match(/(\d{2,})/);
  return match ? Number(match[1]) : 0;
}

function parseEnglishBirthday(value) {
  const text = String(value || "");
  const months = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };
  const match = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
  if (!match) return "";
  return `${months[match[1].toLowerCase()]}\uC6D4 ${Number(match[2])}\uC77C`;
}

function mapOrigin(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return {};
  if (text.includes("foosha")) return { originRegion: "east-blue", originCountry: "foosha-village", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uD6C4\uC0E4 \uB9C8\uC744" };
  if (text.includes("dawn")) return { originRegion: "east-blue", originCountry: "dawn-island", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uB3C8 \uC12C" };
  if (text.includes("shimotsuki")) return { originRegion: "east-blue", originCountry: "shimotsuki-village", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uC2DC\uBAA8\uCE20\uD0A4 \uB9C8\uC744" };
  if (text.includes("syrup")) return { originRegion: "east-blue", originCountry: "syrup-village", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uC2DC\uB7FD \uB9C8\uC744" };
  if (text.includes("cocoyasi") || text.includes("conomi")) return { originRegion: "east-blue", originCountry: "conomi-islands", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uCF54\uB178\uBBF8 \uC81C\uB3C4" };
  if (text.includes("loguetown")) return { originRegion: "east-blue", originCountry: "loguetown", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8 / \uB85C\uADF8\uD0C0\uC6B4" };
  if (text.includes("east blue")) return { originRegion: "east-blue", originCountry: "", origin: "\uC774\uC2A4\uD2B8 \uBE14\uB8E8" };
  if (text.includes("west blue")) return { originRegion: "west-blue", originCountry: "", origin: "\uC6E8\uC2A4\uD2B8 \uBE14\uB8E8" };
  if (text.includes("south blue")) return { originRegion: "south-blue", originCountry: "", origin: "\uC0AC\uC6B0\uC2A4 \uBE14\uB8E8" };
  if (text.includes("north blue")) return { originRegion: "north-blue", originCountry: "", origin: "\uB178\uC2A4 \uBE14\uB8E8" };
  if (text.includes("grand line")) return { originRegion: "grand-line", originCountry: "", origin: "\uADF8\uB79C\uB4DC\uB77C\uC778" };
  return {};
}

function mapOrganization(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("straw hat pirates")) return { organization: "pirates", subOrganization: "straw-hat" };
  if (text.includes("red hair pirates")) return { organization: "pirates", subOrganization: "red-hair" };
  if (text.includes("marines") || text.includes("marine")) return { organization: "navy" };
  if (text.includes("revolutionary army")) return { organization: "revolutionary" };
  if (text.includes("pirates")) return { organization: "pirates" };
  return {};
}

function mapFactionToOrganization(factionId) {
  if (factionId === 5) return "revolutionary";
  if (factionId === 6) return "pirates";
  if (factionId === 7) return "navy";
  return "etc";
}

function officialOrgIdToLocalId(orgId) {
  return COMMON_ORG_IDS.get(orgId) || `wt-org-${orgId}`;
}

function mapFruitType(value) {
  if (/Logia/i.test(value)) return "logia";
  if (/Zoan/i.test(value)) return "zoan";
  return "paramecia";
}

function modelFromFruitName(value) {
  const text = String(value || "");
  const colonModel = text.match(/Model:\s*([^;)]+)/i)?.[1];
  const suffixModel = text.match(/,\s*([^,;()]+?)\s+Model\b/i)?.[1];
  return String(colonModel || suffixModel || "").replace(/\s*\(.*/g, "").trim();
}

function faceIdFromPerson(person) {
  const match = String(person.imageUrl || "").match(/faces\/(\d+)\.png/i);
  return match ? Number(match[1]) : 0;
}

function wikiUrl(title) {
  return `https://onepiece.fandom.com/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

function unique(list) {
  return [...new Set(list)];
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `item-${Date.now()}`;
}

function safeName(title) {
  return title.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
