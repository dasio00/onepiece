import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const CACHE_DIR = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "chapters");
const OUTPUT_PATH = path.join(ROOT, "tools", "wiki-episode-output.json");
const API = "https://onepiece.fandom.com/api.php";
const START_MARKER = "/* WIKI_EPISODE_AUTO_START */";
const END_MARKER = "/* WIKI_EPISODE_AUTO_END */";
const PERSON_TITLE_OVERRIDES = new Map([
  ["lordofthecoast", "wt100-20"]
]);

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const apply = args.get("apply") === "true";
const applyOutput = args.get("apply-output") === "true";
const mergeOutput = args.get("merge-output") === "true";
const start = Number(args.get("start") || 1);
const limit = Number(args.get("limit") || 100);
const end = Number(args.get("end") || (start + limit - 1));

await fs.mkdir(CACHE_DIR, { recursive: true });

const dataText = await fs.readFile(DATA_PATH, "utf8");
const data = loadData(dataText);

if (applyOutput) {
  const previous = JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
  await fs.writeFile(DATA_PATH, applyEpisodeBlock(dataText, previous.episodes || []));
  console.log(JSON.stringify({
    appliedOutput: true,
    episodes: previous.episodes?.length || 0,
    misses: previous.misses?.length || 0
  }, null, 2));
  process.exit(0);
}

const personMap = buildPersonTitleMap(data.people);
const techniqueMap = buildTechniqueNameMap(data.techniques);
let episodes = [];
let misses = [];

for (let chapter = start; chapter <= end; chapter += 1) {
  const pageTitle = `Chapter ${chapter}`;
  try {
    const source = await getChapterSource(pageTitle);
    const parsed = parseChapter(pageTitle, source, personMap, techniqueMap);
    episodes.push(parsed);
  } catch (error) {
    misses.push({ chapter, error: String(error.message || error) });
  }
}

if (mergeOutput) {
  ({ episodes, misses } = await mergeWithPreviousOutput(episodes, misses, start, end));
}

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), start, end, episodes, misses }, null, 2)}\n`);

if (apply) {
  await fs.writeFile(DATA_PATH, applyEpisodeBlock(dataText, episodes));
}

console.log(JSON.stringify({
  start,
  end,
  episodes: episodes.length,
  misses: misses.length,
  output: path.relative(ROOT, OUTPUT_PATH),
  applied: apply
}, null, 2));

function loadData(text) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(text, context, { filename: "data.js" });
  return context.window.onePieceData;
}

async function mergeWithPreviousOutput(currentEpisodes, currentMisses, rangeStart, rangeEnd) {
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
  } catch {
    previous = null;
  }
  if (!previous) return { episodes: currentEpisodes, misses: currentMisses };

  const inRange = (chapter) => Number(chapter) >= rangeStart && Number(chapter) <= rangeEnd;
  const episodeMap = new Map();
  for (const episode of previous.episodes || []) {
    if (!inRange(episode.number)) episodeMap.set(episode.number, episode);
  }
  for (const episode of currentEpisodes) episodeMap.set(episode.number, episode);

  const missMap = new Map();
  for (const miss of previous.misses || []) {
    if (!inRange(miss.chapter)) missMap.set(miss.chapter, miss);
  }
  for (const miss of currentMisses) missMap.set(miss.chapter, miss);

  return {
    episodes: [...episodeMap.values()].sort((a, b) => a.number - b.number),
    misses: [...missMap.values()].sort((a, b) => a.chapter - b.chapter)
  };
}

async function getChapterSource(pageTitle) {
  const cachePath = path.join(CACHE_DIR, `${safeName(pageTitle)}.json`);
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    const [html, wikitext] = await Promise.all([
      fetchWikiParse(pageTitle, "text"),
      fetchWikiParse(pageTitle, "wikitext")
    ]);
    const source = { pageTitle, html, wikitext };
    await fs.writeFile(cachePath, `${JSON.stringify(source)}\n`);
    return source;
  }
}

async function fetchWikiParse(page, prop) {
  const url = new URL(API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", prop);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  let lastError = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Wiki request failed ${res.status}: ${page}`);
      const json = await res.json();
      if (json.error) throw new Error(`Wiki parse error ${page}: ${json.error.info}`);
      return prop === "text" ? json.parse.text["*"] : json.parse.wikitext["*"];
    } catch (error) {
      lastError = error.message || String(error);
      if (attempt < 4) await sleep(800 * attempt);
    }
  }
  throw new Error(lastError);
}

function parseChapter(pageTitle, source, personMap, techniqueMap) {
  const fields = extractInfoboxFields(source.html);
  const number = Number(firstFieldByPrefix(fields, "Chapter")) || Number(pageTitle.replace(/\D+/g, ""));
  const volume = Number(firstFieldByPrefix(fields, "Volume")) || 0;
  const title = firstFieldByPrefix(fields, "Viz Title") || cleanWikiText(firstFieldByPrefix(fields, "Japanese Title")) || pageTitle;
  const shortSummary = section(source.wikitext, "Short Summary");
  const summary = summarize(shortSummary);
  const characterLinks = extractCharacterLinks(source.wikitext);
  const techniqueIds = extractTechniqueIds(source.wikitext, techniqueMap);
  const characterIds = unique(characterLinks.map((titleText) => personIdForTitle(titleText, personMap)).filter(Boolean));
  return {
    id: `wiki-chapter-${number}`,
    volume,
    number,
    title,
    summary,
    characterIds,
    techniqueIds,
    sourceTitle: pageTitle,
    sourceUrl: wikiUrl(pageTitle),
    sourceCharacterTitles: characterLinks
  };
}

function extractInfoboxFields(html) {
  const fields = {};
  const pattern = /<h3[^>]*class="pi-data-label[^"]*"[^>]*>(.*?)<\/h3>\s*<div[^>]*class="pi-data-value[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  for (const match of html.matchAll(pattern)) {
    const label = cleanHtml(match[1]);
    const value = cleanHtml(match[2]);
    if (!fields[label]) fields[label] = value;
  }
  return fields;
}

function section(wikitext, heading) {
  const escaped = escapeRegExp(heading);
  const pattern = new RegExp(`(^|\\n)==+\\s*${escaped}\\s*==+\\s*\\n([\\s\\S]*?)(?=\\n==[^=]|$)`, "i");
  return wikitext.match(pattern)?.[2] || "";
}

function extractCharacterLinks(wikitext) {
  const characters = section(wikitext, "Characters");
  const links = [];
  for (const line of characters.split(/\r?\n/)) {
    if (!line.trim().startsWith("*")) continue;
    if (/\(mentioned only\)/i.test(line)) continue;
    const link = line.match(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/);
    if (!link) continue;
    const title = link[1].trim();
    if (isNonCharacterTitle(title)) continue;
    links.push(title);
  }
  return unique(links);
}

function extractTechniqueIds(wikitext, techniqueMap) {
  const text = normalizeTechniqueText(cleanWikiText(wikitext));
  const ids = [];
  for (const [name, id] of techniqueMap.entries()) {
    if (name.length < 8) continue;
    if (text.includes(name)) ids.push(id);
  }
  return unique(ids).slice(0, 40);
}

function summarize(wikitext) {
  const cleaned = cleanWikiText(wikitext);
  return cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 900);
}

function cleanWikiText(value) {
  let text = String(value || "");
  for (let i = 0; i < 4; i += 1) text = text.replace(/\{\{[^{}]*\}\}/g, "");
  return text
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[(?:File|Image|Category):[^\]]+\]\]/gi, "")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function buildPersonTitleMap(people) {
  const exact = new Map();
  const short = new Map();
  for (const person of people) {
    const candidates = [
      person.wikiReferenceOnly ? "" : person.wikiTitle,
      person.sourceNameEn,
      stripParenthetical(person.sourceNameEn),
      person.name
    ].filter(Boolean);
    for (const candidate of candidates) {
      const key = titleKey(candidate);
      if (key && !exact.has(key)) exact.set(key, person.id);
    }
    const shortKey = titleKey(stripParenthetical(person.sourceNameEn));
    if (shortKey && shortKey.length >= 5) {
      if (!short.has(shortKey)) short.set(shortKey, []);
      short.get(shortKey).push(person.id);
    }
  }
  return { exact, short };
}

function personIdForTitle(title, maps) {
  const key = titleKey(title);
  if (!key) return "";
  if (PERSON_TITLE_OVERRIDES.has(key)) return PERSON_TITLE_OVERRIDES.get(key);
  if (maps.exact.has(key)) return maps.exact.get(key);
  const matches = [];
  for (const [shortKey, ids] of maps.short.entries()) {
    if (key.endsWith(shortKey)) matches.push(...ids);
  }
  const uniqueMatches = unique(matches);
  return uniqueMatches.length === 1 ? uniqueMatches[0] : "";
}

function buildTechniqueNameMap(techniques) {
  const map = new Map();
  for (const technique of techniques) {
    const key = normalizeTechniqueText(technique.name);
    if (key && !map.has(key)) map.set(key, technique.id);
  }
  return map;
}

function firstFieldByPrefix(fields, prefix) {
  const target = normalizeLabel(prefix);
  const entry = Object.entries(fields || {}).find(([label]) => normalizeLabel(label).startsWith(target));
  return entry?.[1] || "";
}

function titleKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龠]+/g, "");
}

function normalizeTechniqueText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}

function stripParenthetical(value) {
  return String(value || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function isNonCharacterTitle(title) {
  return /^(Pirate|Pirates|Marine|Marines|Bounty Hunter|Citizens?|Animals?|Animal Species|Outlaws?|Revolutionary Army|Straw Hat Pirates|Red Hair Pirates|Alvida Pirates)$/i.test(title);
}

function applyEpisodeBlock(text, episodes) {
  const body = `
${START_MARKER}
(() => {
  const data = window.onePieceData;
  const episodes = ${JSON.stringify(episodes, null, 2)};
  data.episodes = data.episodes.filter((episode) => {
    if (String(episode.id || "").startsWith("wiki-chapter-")) return false;
    if ((episode.id === "episode-1" || episode.id === "episode-2") && String(episode.summary || "").includes("예시")) return false;
    return true;
  });
  const byId = new Map(data.episodes.map((episode) => [episode.id, episode]));
  episodes.forEach((episode) => {
    if (byId.has(episode.id)) Object.assign(byId.get(episode.id), episode);
    else data.episodes.push(episode);
  });
})();
${END_MARKER}
`;
  const blockPattern = new RegExp(`\\n?${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`);
  if (blockPattern.test(text)) return text.replace(blockPattern, `\n${body}`);
  return `${text.trimEnd()}\n${body}`;
}

function wikiUrl(title) {
  return `https://onepiece.fandom.com/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

function safeName(title) {
  return title.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function unique(list) {
  return [...new Set(list)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
