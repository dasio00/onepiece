import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const TECHNIQUE_CACHE_DIR = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "techniques");
const PAGE_CACHE_DIR = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "pages");
const LUFFY_NAMU_PATH = path.join(ROOT, "tools", "luffy-namu-techniques.json");
const EPISODE_NAMU_PATH = path.join(ROOT, "tools", "episode-namu-titles.json");
const START_MARKER = "/* LOCALIZATION_AUTO_START */";
const END_MARKER = "/* LOCALIZATION_AUTO_END */";

const FRUIT_WORDS = new Map(Object.entries({
  Age: "나이",
  Allosaurus: "알로사우루스",
  Anaconda: "아나콘다",
  Arms: "무기",
  Arrow: "화살",
  Art: "예술",
  Azure: "청룡",
  Awa: "거품",
  Barrier: "배리어",
  Barrel: "통",
  Baku: "우걱",
  Bane: "스프링",
  Bara: "동강",
  Bat: "박쥐",
  Berry: "베리",
  Bird: "새",
  Bis: "비스킷",
  Beta: "끈적",
  Boing: "용수철",
  Bomu: "폭탄",
  Bomb: "폭탄",
  Book: "책",
  Boom: "폭발",
  Brain: "뇌",
  Brachiosaurus: "브라키오사우루스",
  Brush: "붓",
  Bubble: "거품",
  Bug: "벌레",
  Butter: "버터",
  Cage: "우리",
  Caiman: "카이만",
  Calm: "고요",
  Castle: "성",
  Cat: "고양이",
  Chop: "동강",
  Clear: "투명",
  Clone: "복사",
  Cook: "요리",
  Cream: "크림",
  Dachshund: "닥스훈트",
  Dark: "어둠",
  Dice: "싹둑",
  Doa: "문",
  Doku: "독",
  Dog: "개",
  Door: "문",
  Doru: "밀랍",
  Dragon: "용",
  Egg: "알",
  Elephant: "코끼리",
  Falcon: "매",
  Fish: "물고기",
  Flame: "이글",
  Flare: "불꽃",
  Float: "둥실",
  Flower: "꽃",
  Flying: "날다람쥐",
  Fude: "붓",
  Garb: "옷",
  Gas: "가스",
  Giraffe: "기린",
  Glare: "째릿",
  Glint: "번쩍",
  Glug: "꿀꺽",
  Gomu: "고무",
  Gorilla: "고릴라",
  Goro: "번개",
  Giro: "째릿",
  Grow: "성장",
  Gura: "흔들",
  Gum: "고무",
  Guru: "회전",
  Hana: "꽃",
  Heal: "치유",
  Heat: "열",
  Hie: "얼음",
  Hito: "사람",
  Hobby: "하비",
  Hobi: "하비",
  Horo: "유령",
  Hollow: "유령",
  Horm: "호르몬",
  Hor: "호르몬",
  Horse: "말",
  Human: "사람",
  Ice: "얼음",
  Isle: "섬",
  Jacket: "재킷",
  Jackal: "자칼",
  Jiki: "자석",
  Kage: "그림자",
  King: "킹코브라",
  Kilo: "킬로",
  Kibi: "수수",
  Kirin: "기린",
  Kuri: "크림",
  Leopard: "표범",
  Lick: "핥기",
  Love: "매료",
  Mag: "마그마",
  Magma: "마그마",
  Magu: "마그마",
  Mane: "복사",
  Magnet: "자석",
  Mark: "표적",
  Mato: "표적",
  Memo: "메모",
  Mera: "이글",
  Mero: "매료",
  Millet: "수수",
  Mirror: "거울",
  Mochi: "떡",
  Mole: "두더지",
  Moku: "뭉게",
  Mori: "숲",
  Muchi: "채찍",
  Munch: "우걱",
  Mutt: "개",
  Nagi: "고요",
  Nika: "니카",
  Noro: "느릿",
  Numa: "늪",
  Nui: "꿰매",
  Op: "수술",
  Ope: "수술",
  Ox: "소",
  Paw: "도톰",
  Pegasus: "페가수스",
  Pero: "핥기",
  Phoenix: "불사조",
  Pika: "번쩍",
  Pile: "파일",
  Pocket: "포켓",
  Pop: "팝",
  Press: "중력",
  Puff: "퍼프",
  Pump: "펌프",
  Push: "밀기",
  Pteranodon: "프테라노돈",
  Rabbit: "토끼",
  Revive: "부활",
  Ride: "라이드",
  Ripple: "파문",
  Ripe: "숙성",
  Rumble: "번개",
  Rust: "녹",
  Sara: "도롱",
  Sand: "모래",
  Scroll: "두루마리",
  Shadow: "그림자",
  Shear: "가위",
  Sick: "질병",
  Sickle: "낫",
  Sing: "노래",
  Slip: "미끌",
  Slow: "느릿",
  Smoke: "뭉게",
  Smooth: "매끈",
  Snake: "뱀",
  Snow: "눈",
  Soul: "소울",
  Soru: "소울",
  Spike: "가시",
  Spin: "회전",
  Spring: "스프링",
  Steam: "증기",
  Stitch: "꿰매",
  Stone: "돌",
  Straw: "짚",
  String: "실",
  Strong: "힘",
  Sube: "매끈",
  Supa: "싹둑",
  Squirrel: "다람쥐",
  Swim: "헤엄",
  Tanuki: "너구리",
  Thorn: "가시",
  Time: "시간",
  Toge: "가시",
  Toki: "시간",
  Ton: "톤",
  Tone: "톤",
  Tori: "새",
  Tremor: "흔들",
  Turtle: "거북",
  Tweet: "새",
  Uo: "물고기",
  Venom: "독",
  Warp: "워프",
  Wash: "워시",
  Wax: "밀랍",
  Wheel: "바퀴",
  Whip: "채찍",
  Wolf: "늑대",
  Woods: "숲",
  Wring: "쥐어짜기",
  Yami: "어둠",
  Yomi: "부활",
  Yuki: "눈",
  Zushi: "쿠궁",
}));

const EXACT_FRUIT_NAMES = new Map(Object.entries({
  "Bara-Bara Fruit": "동강동강 열매",
  "Bomb-Bomb Fruit": "폭폭 열매",
  "Chop-Chop Fruit": "동강동강 열매",
  "Clear-Clear Fruit": "투명투명 열매",
  "Flame-Flame Fruit": "이글이글 열매",
  "Flower-Flower Fruit": "꽃꽃 열매",
  "Gum-Gum Fruit": "고무고무 열매",
  "Hana-Hana Fruit": "꽃꽃 열매",
  "Human-Human Fruit": "사람사람 열매",
  "Ice-Ice Fruit": "얼음얼음 열매",
  "Mera-Mera Fruit": "이글이글 열매",
  "Op-Op Fruit": "수술수술 열매",
  "Paw-Paw Fruit": "도톰도톰 열매",
  "Sand-Sand Fruit": "모래모래 열매",
  "Slip-Slip Fruit": "미끌미끌 열매",
  "Smoke-Smoke Fruit": "뭉게뭉게 열매",
  "String-String Fruit": "실실 열매",
  "Tremor-Tremor Fruit": "흔들흔들 열매",
}));

const EXACT_FRUIT_IDS = new Map(Object.entries({
  "gum-gum": "고무고무 열매",
}));

const EXACT_FRUIT_JA_IDS = new Map(Object.entries({
  "gum-gum": "ゴムゴムの実",
}));

const TECHNIQUE_PREFIXES = new Map(Object.entries({
  "Bara Bara": "동강동강",
  "Doku Doku": "독독",
  "Gomu Gomu": "고무고무",
  "Goro Goro": "번개번개",
  "Gura Gura": "흔들흔들",
  "Hana Hana": "꽃꽃",
  "Hie Hie": "얼음얼음",
  "Horo Horo": "유령유령",
  "Ito Ito": "실실",
  "Jiki Jiki": "자석자석",
  "Magu Magu": "마그마그",
  "Mera Mera": "이글이글",
  "Mero Mero": "매료매료",
  "Mochi Mochi": "떡떡",
  "Nikyu Nikyu": "도톰도톰",
  "Ope Ope": "수술수술",
  "Pika Pika": "번쩍번쩍",
  "Soru Soru": "소울소울",
  "Suna Suna": "모래모래",
  "Tori Tori": "새새",
  "Uo Uo": "물고기물고기",
  "Yami Yami": "어둠어둠",
  "Yomi Yomi": "부활부활",
  "Zushi Zushi": "쿠궁쿠궁",
}));

const LUFFY_NAMU_HAND_TECHNIQUE_NAMES = new Map(Object.entries({
  "wiki-tech-gomu-gomu-no-pistol": "고무고무 총 (피스톨)",
  "wiki-tech-gomu-gomu-no-pistol-shot": "고무고무 총 (피스톨) 산탄 (샷)",
  "wiki-tech-gomu-gomu-no-rocket": "고무고무 로켓",
  "wiki-tech-gomu-gomu-no-tsuchi": "고무고무 해머",
  "wiki-tech-gomu-gomu-no-kama": "고무고무 낫",
  "wiki-tech-gomu-gomu-no-bazooka": "고무고무 바주카",
  "wiki-tech-gomu-gomu-no-gatling": "고무고무 총난타 (개틀링)",
  "wiki-tech-buso-koka-gomu-gomu-no-gatling": "무장 강화 고무고무 총난타 (개틀링)",
  "wiki-tech-gomu-gomu-no-ogama": "고무고무 대형 낫",
  "wiki-tech-gomu-gomu-no-bullet": "고무고무 총탄 (불릿)",
  "wiki-tech-buso-koka-gomu-gomu-no-bullet": "무장 강화 고무고무 총탄 (불릿)",
  "wiki-tech-gomu-gomu-no-kazaguruma": "고무고무 풍차",
  "wiki-tech-gomu-gomu-no-tate": "고무고무 방패",
  "wiki-tech-gomu-gomu-no-ami": "고무고무 그물",
  "wiki-tech-gomu-gomu-no-bow-gun": "고무고무 석궁",
  "wiki-tech-gomu-gomu-no-storm": "고무고무 폭풍우 (스톰)",
  "wiki-tech-gomu-gomu-no-rifle": "고무고무 회전탄 (라이플)",
  "wiki-tech-gomu-gomu-no-cannon": "고무고무 공성포 (캐넌)",
  "wiki-tech-gomu-gomu-no-ame": "고무고무 비",
  "wiki-tech-gomu-gomu-no-snake-shot": "고무고무 뱀 총 (스네이크 샷)",
  "wiki-tech-gomu-gomu-no-tsuppari": "고무고무 밀쳐내기",
  "wiki-tech-gomu-gomu-no-amidori": "고무고무 움켜쥐기",
  "wiki-tech-gomu-gomu-no-nagenawa": "고무고무 밧줄 감기",
  "wiki-tech-gomu-gomu-no-tsuribashi": "고무고무 다리",
  "wiki-tech-gomu-gomu-no-propeller": "고무고무 프로펠러",
  "wiki-tech-gomu-gomu-no-sadowari": "고무고무 모래 가르기",
  "wiki-tech-gomu-gomu-no-zenmai": "고무고무 용수철",
  "wiki-tech-gomu-gomu-no-bungee": "고무고무 번지",
  "wiki-tech-gomu-gomu-no-tomotsuna": "고무고무 밧줄",
  "wiki-tech-gomu-gomu-no-yo-yo": "고무고무 요요",
  "wiki-tech-gomu-gomu-no-koma": "고무고무 팽이",
  "wiki-tech-gomu-gomu-no-twin-pistol": "고무고무 트윈 총 (피스톨)",
  "wiki-tech-gomu-gomu-no-hyakuman-do-bazooka": "고무고무 백만도 바주카",
  "wiki-tech-gomu-gomu-no-mushitoriami": "고무고무 잠자리채",
  "wiki-tech-gomu-gomu-no-ricochet": "고무고무 리코셰",
  "wiki-tech-gomu-gomu-no-jutte": "고무고무 짓테",
  "wiki-tech-gomu-gomu-no-senjukannon": "고무고무 천수관음",
  "wiki-tech-gomu-gomu-no-screw": "고무고무 스크류",
  "wiki-tech-gomu-gomu-no-home-run": "고무고무 홈런",
  "wiki-tech-gomu-gomu-no-gomu-doryoku": "고무고무 고무 동력",
}));

const TECHNIQUE_WORDS = new Map(Object.entries({
  Age: "에이지",
  Axe: "도끼",
  Balloon: "풍선",
  Bazooka: "바주카",
  Bear: "베어",
  Bell: "종",
  Bird: "버드",
  Black: "블랙",
  Bullet: "탄환",
  Cannon: "대포",
  Clutch: "클러치",
  Cobra: "코브라",
  Dawn: "새벽",
  Elephant: "엘리펀트",
  Fire: "불",
  Gatling: "개틀링",
  Gigant: "기간트",
  Grab: "그랩",
  Gun: "건",
  Hawk: "호크",
  Jet: "제트",
  King: "킹",
  Kong: "콩",
  Lightning: "번개",
  Missile: "미사일",
  Organ: "오르간",
  Pistol: "총",
  Red: "레드",
  Rifle: "라이플",
  Rocket: "로켓",
  Shot: "샷",
  Spear: "창",
  Stamp: "스탬프",
  Storm: "폭풍",
  Thor: "토르",
  Whip: "채찍",
}));

const TYPE_LABELS = {
  paramecia: "초인계",
  zoan: "동물계",
  logia: "자연계",
  smile: "스마일",
  unknown: "미분류",
};

const ZOAN_LABELS = {
  normal: "일반종",
  ancient: "고대종",
  mythical: "환수종",
};

async function main() {
  const dataText = await fs.readFile(DATA_PATH, "utf8");
  const data = loadData(dataText);
  const techniqueJapanese = await readTechniqueJapaneseNames();
  const fruitJapanese = await readFruitJapaneseNames(data);
  const luffyNamu = await readJsonFile(LUFFY_NAMU_PATH, { namePatches: {}, entries: [] });
  const episodeNamu = await readJsonFile(EPISODE_NAMU_PATH, { titlePatches: {} });
  const luffyNamuEntries = normalizeLuffyNamuEntries(luffyNamu.entries || []);
  const techniquePatches = buildTechniquePatches(data, techniqueJapanese, luffyNamu.namePatches || {});
  const fruitPatches = buildFruitPatches(data, fruitJapanese);
  const block = buildLocalizationBlock(techniquePatches, fruitPatches, luffyNamuEntries, episodeNamu.titlePatches || {});
  await fs.writeFile(DATA_PATH, replaceBlock(dataText, block));
  console.log(JSON.stringify({
    techniquePatches: Object.keys(techniquePatches).length,
    techniqueJapanese: Object.values(techniquePatches).filter((item) => item.nameJa).length,
    luffyTechniqueEntries: luffyNamuEntries.length,
    episodeTitlePatches: Object.keys(episodeNamu.titlePatches || {}).length,
    fruitPatches: Object.keys(fruitPatches).length,
    fruitJapanese: Object.values(fruitPatches).filter((item) => item.nameJa).length,
  }, null, 2));
}

function loadData(text) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(text, context, { filename: DATA_PATH });
  return context.window.onePieceData;
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function normalizeLuffyNamuEntries(entries) {
  return entries
    .map((entry) => removeEmpty({
      ...entry,
      name: entry.nameKo || entry.name || entry.nameJa || entry.nameEn,
      ownerId: entry.ownerId || "wt100-1",
    }))
    .filter((entry) => entry.id && entry.name);
}

async function readTechniqueJapaneseNames() {
  const map = new Map();
  const files = await fs.readdir(TECHNIQUE_CACHE_DIR).catch(() => []);
  for (const file of files.filter((name) => name.endsWith(".html"))) {
    const html = await fs.readFile(path.join(TECHNIQUE_CACHE_DIR, file), "utf8");
    const sourceTitle = sourceTitleFromTechniqueFile(file);
    map.set(sourceTitle, extractTechniqueNames(html));
  }
  return map;
}

async function readFruitJapaneseNames(data) {
  const byEnglish = new Map();
  const byRomanized = new Map();
  const files = await fs.readdir(TECHNIQUE_CACHE_DIR).catch(() => []);
  for (const file of files.filter((name) => name.endsWith(".html"))) {
    const html = await fs.readFile(path.join(TECHNIQUE_CACHE_DIR, file), "utf8");
    const nameJa = parseInfoboxValue(html, "jname");
    const nameEn = parseInfoboxValue(html, "ename");
    if (!nameJa) continue;
    splitNames(nameEn).forEach((name) => byEnglish.set(normalizeName(name), nameJa));
    const romanizedTitle = file.replace(/\.html$/i, "").replace(/_/g, " ");
    byRomanized.set(normalizeName(romanizedTitle), nameJa);
    byRomanized.set(normalizeName(romanizedTitle.replace(/\s+Techniques$/i, "")), nameJa);
  }

  const peopleById = new Map((data.people || []).map((person) => [person.id, person]));
  const result = new Map();
  for (const fruit of data.devilFruits || []) {
    if (EXACT_FRUIT_JA_IDS.has(fruit.id)) {
      result.set(fruit.id, EXACT_FRUIT_JA_IDS.get(fruit.id));
      continue;
    }
    const primaryEnglish = splitNames(fruit.nameEn || fruit.name)[0] || fruit.nameEn || fruit.name;
    const fromEnglish = byEnglish.get(normalizeName(primaryEnglish));
    if (fromEnglish) {
      result.set(fruit.id, fromEnglish);
      continue;
    }

    const user = peopleById.get(fruit.currentUserId);
    const pageTitle = user?.wikiTitle;
    if (!pageTitle) continue;
    const page = await readPageCache(pageTitle);
    const pageFruitNames = (page?.fieldValues?.["Japanese Name:"] || page?.fieldValues?.["Japanese Name"] || []).slice(1);
    const romanized = pageFruitNames.find((name) => / no Mi/i.test(name)) || pageFruitNames[0] || "";
    const fromRomanized = byRomanized.get(normalizeName(romanized)) || byRomanized.get(normalizeName(romanized.replace(/\([^)]*\)/g, "")));
    if (fromRomanized) result.set(fruit.id, fromRomanized);
    else if (romanized) result.set(fruit.id, romanized);
  }
  return result;
}

async function readPageCache(title) {
  const cachePath = path.join(PAGE_CACHE_DIR, `${safeName(title)}.json`);
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function extractTechniqueNames(html) {
  const map = new Map();
  const listItemPattern = /<li[^>]*>\s*<b>([\s\S]*?)<\/b>([\s\S]{0,1800}?)<span\b(?=[^>]*lang=["']ja["'])[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = listItemPattern.exec(html))) {
    const nameEn = cleanText(match[1]);
    const nameJa = cleanText(match[3]);
    if (isTechniqueName(nameEn) && nameJa && !map.has(normalizeName(nameEn))) {
      map.set(normalizeName(nameEn), nameJa);
    }
  }
  return map;
}

function buildTechniquePatches(data, techniqueJapanese, luffyPatches = {}) {
  const patches = {};
  for (const technique of data.techniques || []) {
    const nameEn = String(technique.nameEn || technique.name || "").trim();
    const sourceMap = techniqueJapanese.get(technique.sourceTitle);
    const luffyPatch = luffyPatches[technique.id] || {};
    const nameJa = luffyPatch.nameJa || sourceMap?.get(normalizeName(nameEn)) || "";
    const nameKo = luffyPatch.nameKo || LUFFY_NAMU_HAND_TECHNIQUE_NAMES.get(technique.id) || koreanTechniqueName(nameEn);
    if (!nameJa && !nameKo && !hasLatin(nameEn)) continue;
    patches[technique.id] = removeEmpty({ nameKo, nameJa });
  }
  return patches;
}

function buildFruitPatches(data, fruitJapanese) {
  const patches = {};
  for (const fruit of data.devilFruits || []) {
    const nameEn = String(fruit.nameEn || fruit.name || "").trim();
    const nameKo = EXACT_FRUIT_IDS.get(fruit.id) || koreanFruitName(nameEn);
    const nameJa = fruitJapanese.get(fruit.id) || "";
    const descriptionKo = koreanFruitDescription({ ...fruit, nameKo });
    patches[fruit.id] = removeEmpty({ nameKo, nameJa, descriptionKo });
  }
  return patches;
}

function koreanFruitDescription(fruit) {
  const type = TYPE_LABELS[fruit.type] || TYPE_LABELS.unknown;
  const parts = [`${fruit.nameKo || "이 열매"}는 ${type} 악마의 열매입니다.`];
  if (fruit.type === "zoan" && fruit.zoanSubtype) parts.push(`동물계 세부 구분은 ${ZOAN_LABELS[fruit.zoanSubtype] || fruit.zoanSubtype}입니다.`);
  if (fruit.model) parts.push(`모델은 ${fruit.model}입니다.`);
  parts.push("영어 위키의 계통·능력자 정보를 기준으로 자동 정리했습니다.");
  return parts.join(" ");
}

function koreanFruitName(name) {
  const primary = cleanNameVariant(splitNames(name)[0] || name);
  if (!primary) return "";
  if (hasHangul(primary)) return primary;
  if (EXACT_FRUIT_NAMES.has(primary)) return EXACT_FRUIT_NAMES.get(primary);
  const romanizedMi = primary.match(/^(.+?)\s+no\s+Mi\b/i);
  if (romanizedMi) {
    const baseKo = translateRomanizedFruitBase(romanizedMi[1]);
    if (baseKo) return `${baseKo} 열매`;
  }
  if (/SMILE$/i.test(primary)) {
    const animal = primary.replace(/\s*SMILE$/i, "").trim();
    return `${translateFruitPhrase(animal) || animal} 스마일`;
  }

  const fruitMatch = primary.match(/^(.+?)\s+Fruit(?:,\s*(?:Model|Form|Type|Variety):?\s*(.+))?$/i);
  if (!fruitMatch) {
    const ability = primary.replace(/\s+(?:Ability|Power|Jutsu)$/i, "").trim();
    const translated = translateFruitPhrase(ability);
    return translated ? `${translated} 능력` : "";
  }

  const base = fruitMatch[1].trim();
  const model = fruitMatch[2]?.trim();
  const baseKo = translateRepeatedFruitName(base) || translateFruitPhrase(base);
  if (!baseKo) return "";
  return model ? `${baseKo} 열매 모델: ${translateFruitPhrase(model) || model}` : `${baseKo} 열매`;
}

function koreanTechniqueName(name) {
  const clean = String(name || "").trim();
  if (!clean || hasHangul(clean)) return clean;
  for (const [prefix, prefixKo] of TECHNIQUE_PREFIXES) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)} no\\s+(.+)$`, "i");
    const match = clean.match(pattern);
    if (!match) continue;
    const rest = translateTechniquePhrase(match[1]);
    return rest ? `${prefixKo} ${rest}` : prefixKo;
  }
  if (/^Oni Giri$/i.test(clean)) return "삼도류 귀참";
  if (/^ROOM$/i.test(clean)) return "룸";
  const translated = translateTechniquePhrase(clean);
  return translated && translated !== clean ? translated : "";
}

function translateRepeatedFruitName(base) {
  const match = base.match(/^([A-Za-z]+)-\1$/i) || base.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
  if (!match) return "";
  const first = FRUIT_WORDS.get(toTitleCase(match[1]));
  const second = FRUIT_WORDS.get(toTitleCase(match[2] || match[1]));
  if (!first || !second) return "";
  return first === second ? `${first}${first}` : `${first}${second}`;
}

function translateRomanizedFruitBase(base) {
  const words = String(base || "").split(/\s+/).filter(Boolean);
  if (words.length === 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    const translated = FRUIT_WORDS.get(toTitleCase(words[0]));
    return translated ? `${translated}${translated}` : "";
  }
  return translateFruitPhrase(base);
}

function translateFruitPhrase(text) {
  const words = String(text || "").replace(/-/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const translated = words.map((word) => FRUIT_WORDS.get(toTitleCase(word)) || "").filter(Boolean);
  if (!translated.length) return "";
  return translated.join(" ");
}

function translateTechniquePhrase(text) {
  return String(text || "")
    .replace(/"([^"]+)"/g, "$1")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const stripped = word.replace(/[^A-Za-z0-9]/g, "");
      return TECHNIQUE_WORDS.get(toTitleCase(stripped)) || word;
    })
    .join(" ")
    .trim();
}

function buildLocalizationBlock(techniquePatches, fruitPatches, luffyNamuEntries, episodeTitlePatches) {
  return `${START_MARKER}
(() => {
  const data = window.onePieceData;
  const techniquePatches = ${JSON.stringify(techniquePatches, null, 2)};
  const fruitPatches = ${JSON.stringify(fruitPatches, null, 2)};
  const luffyNamuEntries = ${JSON.stringify(luffyNamuEntries, null, 2)};
  const episodeTitlePatches = ${JSON.stringify(episodeTitlePatches, null, 2)};
  const hasLatin = (value) => /[A-Za-z]/.test(String(value || ""));
  const hasHangul = (value) => /[가-힣]/.test(String(value || ""));
  const upsertById = (list, item) => {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index === -1) list.push(item);
    else list[index] = { ...list[index], ...item };
  };
  const setNameFields = (item, patch) => {
    if (!item || !patch) return;
    if (!item.nameEn && hasLatin(item.name)) item.nameEn = item.name;
    Object.assign(item, patch);
    if (patch.nameKo && hasHangul(patch.nameKo)) item.name = patch.nameKo;
    else if (patch.nameJa) item.name = patch.nameJa;
  };
  luffyNamuEntries.forEach((entry) => upsertById(data.techniques, entry));
  data.techniques.forEach((technique) => setNameFields(technique, techniquePatches[technique.id]));
  data.devilFruits.forEach((fruit) => {
    if (!fruit.descriptionEn && fruit.description && hasLatin(fruit.description)) fruit.descriptionEn = fruit.description;
    setNameFields(fruit, fruitPatches[fruit.id]);
    if (fruitPatches[fruit.id]?.descriptionKo) {
      fruit.descriptionKo = fruitPatches[fruit.id].descriptionKo;
      fruit.description = fruit.descriptionKo;
    }
  });
  data.episodes.forEach((episode) => {
    if (!episode.summaryEn && episode.summary && hasLatin(episode.summary)) episode.summaryEn = episode.summary;
    const titlePatch = episodeTitlePatches[episode.id];
    if (titlePatch) {
      if (!episode.titleEn && episode.title && hasLatin(episode.title)) episode.titleEn = episode.title;
      Object.assign(episode, titlePatch);
      if (titlePatch.titleKo) episode.title = titlePatch.titleKo;
    }
    const characterCount = Array.isArray(episode.characterIds) ? episode.characterIds.length : 0;
    const techniqueCount = Array.isArray(episode.techniqueIds) ? episode.techniqueIds.length : 0;
    const pieces = [];
    if (characterCount) pieces.push(\`등장 인물 \${characterCount}명\`);
    if (techniqueCount) pieces.push(\`나온 기술 \${techniqueCount}개\`);
    const linked = pieces.length ? \`\${pieces.join(", ")}가 연결되어 있습니다.\` : "연결된 등장 인물과 기술 정보는 아직 정리 중입니다.";
    episode.summaryKo = \`\${episode.number}화는 위키 데이터를 바탕으로 정리한 에피소드입니다. \${linked}\`;
    episode.summary = episode.summaryKo;
  });
})();
${END_MARKER}`;
}

function replaceBlock(text, block) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  if (start !== -1 && end !== -1 && end > start) {
    return `${text.slice(0, start)}${block}${text.slice(end + END_MARKER.length)}`;
  }
  return `${text.trimEnd()}\n\n${block}\n`;
}

function parseInfoboxValue(html, source) {
  const pattern = new RegExp(`data-source=["']${source}["'][\\s\\S]*?<div class=["']pi-data-value pi-font["']>([\\s\\S]*?)<\\/div>`, "i");
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : "";
}

function splitNames(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .split(/\s*;\s*/)
    .map(cleanNameVariant)
    .filter(Boolean);
}

function cleanNameVariant(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function cleanText(html) {
  return decodeHtml(String(html || "")
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(x?[0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sourceTitleFromTechniqueFile(file) {
  const title = file.replace(/\.html$/i, "").replace(/_/g, " ");
  if (title === "Gomu Gomu no Mi Techniques") return "Gomu Gomu no Mi/Techniques";
  if (title === "Tori Tori no Mi Model Phoenix") return "Tori Tori no Mi, Model: Phoenix";
  if (title === "Uo Uo no Mi Model Seiryu") return "Uo Uo no Mi, Model: Seiryu";
  return title;
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function safeName(value) {
  return String(value || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

function toTitleCase(value) {
  const clean = String(value || "").toLowerCase();
  return clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : "";
}

function removeEmpty(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== ""));
}

function isTechniqueName(value) {
  const text = String(value || "");
  return Boolean(text) && text.length < 120 && !/[.:[\]]/.test(text);
}

function hasLatin(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function hasHangul(value) {
  return /[가-힣]/.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
