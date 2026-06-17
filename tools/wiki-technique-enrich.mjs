import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const CACHE_DIR = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "techniques");
const OUTPUT_PATH = path.join(ROOT, "tools", "wiki-technique-output.json");
const API = "https://onepiece.fandom.com/api.php";
const START_MARKER = "/* WIKI_TECHNIQUE_AUTO_START */";
const END_MARKER = "/* WIKI_TECHNIQUE_AUTO_END */";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const apply = args.get("apply") === "true";
const perPage = Number(args.get("per-page") || 80);

const SOURCES = [
  { title: "Gomu Gomu no Mi/Techniques", ownerId: "wt100-1" },
  { title: "Three Sword Style", ownerId: "wt100-2" },
  { title: "Art of Weather", ownerId: "wt100-3" },
  { title: "Pop Greens", ownerId: "wt100-4" },
  { title: "Black Leg Style", ownerId: "wt100-5" }
];

await fs.mkdir(CACHE_DIR, { recursive: true });

const dataText = await fs.readFile(DATA_PATH, "utf8");
const data = loadData(dataText);
const existingNames = new Set(data.techniques.map((item) => normalizeName(item.name)));
const entries = [];

for (const source of SOURCES) {
  const html = await getPageHtml(source.title);
  const names = extractTechniqueNames(html).slice(0, perPage);
  for (const name of names) {
    const normalized = normalizeName(name);
    if (!normalized || existingNames.has(normalized)) continue;
    existingNames.add(normalized);
    entries.push({
      id: `wiki-tech-${slugify(name)}`,
      name,
      ownerId: source.ownerId,
      note: `One Piece Wiki source: ${source.title}`,
      sourceTitle: source.title,
      sourceUrl: wikiUrl(source.title)
    });
  }
}

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);

if (apply) {
  await fs.writeFile(DATA_PATH, applyTechniqueBlock(dataText, entries));
}

console.log(JSON.stringify({
  sources: SOURCES.length,
  techniques: entries.length,
  output: path.relative(ROOT, OUTPUT_PATH),
  applied: apply
}, null, 2));

function loadData(text) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(text, context, { filename: "data.js" });
  return context.window.onePieceData;
}

async function getPageHtml(title) {
  const cachePath = path.join(CACHE_DIR, `${safeName(title)}.html`);
  try {
    return await fs.readFile(cachePath, "utf8");
  } catch {
    const url = new URL(API);
    url.searchParams.set("action", "parse");
    url.searchParams.set("page", title);
    url.searchParams.set("prop", "text");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wiki request failed ${res.status}: ${title}`);
    const json = await res.json();
    if (json.error) throw new Error(`Wiki parse error ${title}: ${json.error.info}`);
    const html = json.parse.text["*"];
    await fs.writeFile(cachePath, html);
    return html;
  }
}

function extractTechniqueNames(html) {
  const names = [];
  const listItemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
  for (const item of html.matchAll(listItemPattern)) {
    const firstBold = item[1].match(/<b[^>]*>([\s\S]*?)<\/b>/);
    if (!firstBold) continue;
    const name = cleanHtml(firstBold[1]);
    if (isLikelyTechniqueName(name)) names.push(name);
  }
  return unique(names)
    .filter((name) => !/^(Overview|Techniques|Trivia|References|Site Navigation)$/i.test(name))
    .filter((name) => name.length <= 90);
}

function isLikelyTechniqueName(name) {
  if (!name || name.length < 3) return false;
  if (/^(Chapter|Episode|Volume|Anime|Manga|Movie|Game|Note|User|Users)$/i.test(name)) return false;
  if (/^[0-9\s.,:;!?-]+$/.test(name)) return false;
  return true;
}

function applyTechniqueBlock(text, entries) {
  const body = `
${START_MARKER}
(() => {
  const data = window.onePieceData;
  const entries = ${JSON.stringify(entries, null, 2)};
  const names = new Set(data.techniques.map((item) => String(item.name || "").trim().toLowerCase()));
  entries.forEach((entry) => {
    const key = String(entry.name || "").trim().toLowerCase();
    if (!key || names.has(key)) return;
    names.add(key);
    data.techniques.push(entry);
  });
})();
${END_MARKER}
`;
  const blockPattern = new RegExp(`\\n?${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`);
  if (blockPattern.test(text)) return text.replace(blockPattern, `\n${body}`);
  return `${text.trimEnd()}\n${body}`;
}

function cleanHtml(html) {
  return String(html || "")
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龠]+/g, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || `tech-${Date.now()}`;
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
