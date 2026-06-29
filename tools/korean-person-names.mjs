import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data.js");
const CACHE_PATH = path.join(ROOT, "tools", ".cache", "onepiece-wiki", "ko-langlinks.json");
const REPORT_PATH = path.join(ROOT, "tools", "korean-person-names-report.json");
const START_MARKER = "/* MANUAL_KOREAN_PERSON_NAMES_START */";
const END_MARKER = "/* MANUAL_KOREAN_PERSON_NAMES_END */";
const API = "https://onepiece.fandom.com/api.php";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const refresh = args.has("--refresh");

const WORD_OVERRIDES = new Map(Object.entries({
  a: "A",
  ace: "에이스",
  aigis: "아이기스",
  amazon: "아마존",
  animal: "동물",
  animals: "동물",
  arm: "암",
  arms: "암즈",
  baby: "베이비",
  baroque: "바로크",
  bear: "베어",
  beast: "비스트",
  beasts: "비스트",
  big: "빅",
  bird: "버드",
  black: "블랙",
  blue: "블루",
  bonney: "보니",
  boy: "보이",
  bros: "형제",
  brothers: "형제",
  buggy: "버기",
  captain: "캡틴",
  cat: "캣",
  chicken: "치킨",
  child: "차일드",
  children: "칠드런",
  cp: "CP",
  cross: "크로스",
  d: "D.",
  da: "다",
  den: "덴",
  denjiro: "덴지로",
  doctor: "닥터",
  don: "돈",
  dragon: "드래곤",
  dr: "닥터",
  east: "이스트",
  elder: "엘더",
  elders: "엘더스",
  emu: "에무",
  fake: "가짜",
  five: "파이브",
  fox: "폭스",
  fruit: "프루트",
  girl: "걸",
  girls: "걸스",
  god: "갓",
  gold: "골드",
  great: "그레이트",
  hair: "헤어",
  heart: "하트",
  human: "휴먼",
  imu: "임",
  king: "킹",
  kingdom: "킹덤",
  kurozumi: "쿠로즈미",
  lady: "레이디",
  light: "라이트",
  little: "리틀",
  local: "로컬",
  lord: "로드",
  marine: "마린",
  mary: "메리",
  master: "마스터",
  merry: "메리",
  mink: "밍크",
  miss: "미스",
  monster: "몬스터",
  mr: "미스터",
  mrs: "미세스",
  new: "뉴",
  no: "노",
  old: "올드",
  piece: "피스",
  pirate: "파이러트",
  pirates: "해적단",
  prince: "프린스",
  princess: "프린세스",
  queen: "퀸",
  red: "레드",
  roger: "로저",
  saint: "성",
  samurai: "사무라이",
  sea: "시",
  serpent: "서펀트",
  shadow: "섀도",
  shandia: "샨디아",
  snake: "스네이크",
  snow: "스노",
  straw: "스트로",
  super: "슈퍼",
  sword: "소드",
  the: "",
  three: "스리",
  tiger: "타이거",
  two: "투",
  vega: "베가",
  vegapunk: "베가펑크",
  water: "워터",
  white: "화이트",
  world: "월드",
  york: "요크",
  zombie: "좀비",
  zombies: "좀비"
}));

const EXACT_OVERRIDES = new Map(Object.entries({
  "Going Merry": "고잉 메리호",
  "Gol D. Roger (Gold Roger)": "골 D. 로저",
  "Lord of the Coast": "근해의 주인",
  "A O.": "에이 오",
  "A O": "에이 오",
  "Carne": "카르네",
  "Carelesso (Ukkari)": "케어레소 (우카리)",
  "Carrot": "캐럿",
  "Laboon": "라분",
  "Crocus": "크로커스",
  "Igaram (Mr. 8/Igarappoi)": "이가람",
  "Karoo": "카루",
  "Gem (Mr. 5)": "젬 (Mr. 5)",
  "Mikita (Miss Valentine)": "미키타 (미스 발렌타인)",
  "Dorry": "도리",
  "Brogy": "브로기",
  "Wapol": "와포루",
  "Chess": "체스",
  "Kuromarimo": "쿠로마리모",
  "Dalton": "돌턴",
  "Dr. Kureha": "Dr. 쿠레하",
  "Hiluluk": "히루루크",
  "Pell": "페루",
  "Chaka": "차카",
  "Lassoo": "랏소",
  "Hina": "히나",
  "Bellamy": "베라미",
  "Sarquiss": "사키스",
  "Masira": "마시라",
  "Shoujou": "쇼조",
  "Mont Blanc Cricket": "몽블랑 크리켓",
  "Mont Blanc Noland": "몽블랑 노랜드",
  "Gan Fall": "간 폴",
  "Pierre": "피에르",
  "Conis": "코니스",
  "Pagaya": "파가야",
  "Satori": "사토리",
  "Shura": "슈라",
  "Aisa": "아이사",
  "Kamakiri": "카마키리",
  "Wyper": "와이퍼",
  "Braham": "브라함",
  "Ohm": "오움",
  "Gedatsu": "게다츠",
  "Yama": "야마",
  "Nola": "노라",
  "Kalgara": "카르가라",
  "Saint Jaygarcia Saturn": "제이가르시아 새턴 성",
  "Saint Marcus Mars": "마커스 마스 성",
  "Saint Topman Warcury": "톱맨 워큐리 성",
  "Saint Ethanbaron V. Nusjuro": "이선바론 V. 나스주로 성",
  "Saint Shepherd Ju Peter": "셰퍼드 주 피터 성",
  "Bartholomew Kuma": "바솔로뮤 쿠마",
  "Lafitte": "라피트",
  "Rockstar": "록스타",
  "Jesus Burgess": "지저스 바제스",
  "Van Auger": "반 오거",
  "Doc Q": "닥 Q",
  "Stronger": "스트롱거",
  "Kuzan (Aokiji)": "쿠잔 (아오키지)",
  "Klabautermann": "클라바우터만",
  "Chimney": "침니",
  "Gonbe": "곤베",
  "Kokoro": "코코로",
  "Zambai": "잠바이",
  "Kaku": "카쿠",
  "Iceburg": "아이스버그",
  "Kalifa": "칼리파",
  "Paulie": "파울리",
  "Hattori": "하토리",
  "Kiwi": "키위",
  "Mozu": "모즈",
  "Blueno": "브루노",
  "Tom": "톰",
  "Yokozuna": "요코즈나",
  "Spandam": "스팬담",
  "T Bone": "T 본",
  "Nero": "네로",
  "Thousand Sunny": "사우전드 써니호",
  "Sodomu": "소돔",
  "Gomora": "고모라",
  "Jabra": "재브라",
  "Fukurou": "후쿠로",
  "Kumadori": "쿠마도리",
  "Kashii": "카아시",
  "Oimo": "오이모",
  "Clou D. Clover": "클로버 박사",
  "Jaguar D. Saul": "하그왈 D. 사우로",
  "Nico Olvia": "니코 올비아",
  "Momonga": "모몬가",
  "Onigumo": "오니구모",
  "Doberman": "도베르만",
  "Yamakaji": "야마카지",
  "Strawberry": "스트로베리",
  "Marco": "마르코",
  "Jozu": "죠즈",
  "Thatch": "삿치",
  "Hogback": "호그백",
  "Absalom": "압살롬",
  "Perona": "페로나",
  "Shimotsuki Ryuma": "시모츠키 류마",
  "Gecko Moria": "겟코 모리아",
  "Oars": "오즈",
  "Charlotte Lola": "샬롯 로라",
  "Camie": "케이미",
  "Pappag": "파파구",
  "Duval": "듀발",
  "Jean Bart": "장 바르트",
  "Shakuyaku (Shakky)": "샤쿠야쿠 (샤키)",
  "Capone Bege": "카포네 벳지",
  "Jewelry Bonney": "쥬얼리 보니",
  "Basil Hawkins": "바질 호킨스",
  "Scratchmen Apoo": "스크래치멘 아푸",
  "X Drake": "X 드레이크",
  "Urouge": "우루지",
  "Killer (Kamazo)": "킬러 (카마조)",
  "Penguin": "펭귄",
  "Bepo": "베포",
  "Shachi": "샤치",
  "Borsalino (Kizaru)": "볼사리노 (키자루)",
  "Sentomaru": "센토마루",
  "Boa Sandersonia": "보아 썬더소니아",
  "Boa Marigold": "보아 마리골드",
  "Hannyabal": "한냐발",
  "Magellan": "마젤란",
  "Saldeath": "살데스",
  "Little Sadi": "리틀 사디",
  "Shiliew": "시류",
  "Inazuma": "이나즈마",
  "Emporio Ivankov": "엠포리오 이반코프",
  "Vista": "비스타",
  "Izo": "이조",
  "Squard": "스쿼드",
  "Portgas D. Rouge": "포트거스 D. 루즈",
  "Littleoars Jr.": "리틀 오즈 Jr.",
  "Pekoms": "페콤즈",
  "Baron Tamago": "타마고 남작",
  "Monet": "모네",
  "Caesar Clown": "시저 클라운",
  "Vergo": "베르고",
  "Kin'Emon": "킨에몬",
  "Kouzuki Momonosuke": "코즈키 모모노스케",
  "Baby Five": "베이비 5",
  "Buffalo": "버팔로",
  "Dr. Vegapunk": "Dr. 베가펑크",
  "Issho (Fujitora)": "잇쇼 (후지토라)",
  "Viola (Violet)": "비올라 (바이올렛)",
  "Kyros (One-Legged Soldier)": "퀴로스",
  "Chinjao": "칭자오",
  "Sai": "사이",
  "Boo": "부",
  "Kelly Funk": "켈리 펑크",
  "Bobby Funk": "바비 펑크",
  "Elizabello Ii": "엘리자벨로 2세",
  "Suleiman": "술레이만",
  "Cavendish (Hakuba)": "캐번디시 (하쿠바)",
  "Rebecca": "레베카",
  "Bartolomeo": "바르톨로메오",
  "Ideao": "이데오",
  "Hajrudin": "하이루딘",
  "Leo": "레오",
  "Wicca": "위카",
  "Giolla": "조라",
  "Gladius": "글라디우스",
  "Dellinger": "델린저",
  "Sugar": "슈거",
  "Senor Pink": "세뇨르 핑크",
  "Lao G": "라오 G",
  "Diamante": "디아만테",
  "Trebol": "트레볼",
  "Pica": "피카",
  "Kurozumi Kanjuro": "쿠로즈미 칸주로",
  "Donquixote Mjosgard": "돈키호테 묘스가르드",
  "Saint Donquixote Shivercalero": "돈키호테 시베르칼레로 성",
  "Donquixote Rosinante (CorazōN)": "돈키호테 로시난테 (코라손)",
  "Trafalgar Lammy": "트라팔가 라미",
  "Edward Weevil": "에드워드 위블",
  "Buckingham Stussy": "버킹엄 스튜시",
  "Zunesha": "즈니샤",
  "Wanda": "완다",
  "Jack": "잭",
  "Sheepshead": "쉽스헤드",
  "Inuarashi": "이누아라시",
  "Nekomamushi": "네코마무시",
  "Vito": "비토",
  "Pedro": "페드로",
  "Raizo": "라이조",
  "Charlotte Pudding": "샬롯 푸딩",
  "Gotti": "고티",
  "Vinsmoke Yonji": "빈스모크 욘디",
  "Vinsmoke Reiju": "빈스모크 레이주",
  "Charlotte Moscato": "샬롯 모스카토",
  "Charlotte Praline": "샬롯 프랄리네",
  "Vinsmoke Judge": "빈스모크 저지",
  "Charlotte Chiffon": "샬롯 시폰",
  "Capone Pez": "카포네 페츠",
  "Charlotte Perosperaw": "샬롯 페로스페로",
  "Charlotte Cracker": "샬롯 크래커",
  "Vinsmoke Ichiji": "빈스모크 이치디",
  "Vinsmoke Niji": "빈스모크 니디",
  "Vinsmoke Sora": "빈스모크 소라",
  "Stussy": "스튜시",
  "Charlotte Mont-D'Or": "샬롯 몽도르",
  "Charlotte Opera": "샬롯 오페라",
  "Charlotte Galette": "샬롯 갈레트",
  "Charlotte Amande": "샬롯 아망드",
  "Charlotte Smoothie": "샬롯 스무디",
  "Napoleon": "나폴레옹",
  "Prometheus": "프로메테우스",
  "Zeus": "제우스",
  "Streusen": "슈트로이젠",
  "Du Feld": "두 펠드",
  "Morgans": "모르건즈",
  "Drug Peclo": "드러그 피에클로",
  "Charlotte Katakuri": "샬롯 카타쿠리",
  "Charlotte Compote": "샬롯 콩포트",
  "Charlotte Daifuku": "샬롯 다이후쿠",
  "Charlotte Oven": "샬롯 오븐",
  "Charlotte Snack": "샬롯 스낵",
  "Carmel (Mother)": "카르멜 (마더)",
  "Gerd": "게르즈",
  "Alber (King)": "알베르 (킹)",
  "Scien (Queen)": "사이언 (퀸)",
  "Toko": "토코",
  "Hyogoro": "효고로",
  "Kozuki Hiyori (Komurasaki)": "코즈키 히요리 (코무라사키)",
  "Shimotsuki Yasuie (Tonoyasu)": "시모츠키 야스이에 (토노야스)",
  "Kurozumi Orochi": "쿠로즈미 오로치",
  "Page One": "페이지 원",
  "Fukurokuju": "후쿠로쿠주",
  "Onimaru (Gyukimaru)": "오니마루 (규키마루)",
  "Kawamatsu": "카와마츠",
  "Shimotsuki Ushimaru": "시모츠키 우시마루",
  "Shimotsuki Kozaburo": "시모츠키 코자부로",
  "Kozuki Oden": "코즈키 오뎅",
  "Kozuki Toki (Amatsuki Toki)": "코즈키 토키 (아마츠키 토키)",
  "Kurozumi Semimaru": "쿠로즈미 세미마루",
  "Kurozumi Higurashi": "쿠로즈미 히구라시",
  "Scopper Gaban": "스코퍼 가반",
  "Ulti": "울티",
  "Who'S-Who": "후즈 후",
  "Black Maria": "블랙 마리아",
  "Sasaki": "사사키",
  "Bao Huang": "바오황",
  "Haccha": "핫차",
  "Aramaki (Ryokugyu)": "아라마키 (료쿠규)",
  "Tensei (Kurouma)": "텐세이 (쿠로우마)",
  "S-Snake": "S-스네이크",
  "S-Hawk": "S-호크",
  "Uta": "우타",
  "Doll": "돌",
  "Hibari": "히바리",
  "Prince Grus": "프린스 그루스",
  "Vegapunk Punk-02 Lilith": "베가펑크 펑크-02 릴리스",
  "Vegapunk Punk-01 Shaka": "베가펑크 펑크-01 샤카",
  "Vegapunk Punk-05 Atlas": "베가펑크 펑크-05 아틀라스",
  "S-Bear": "S-베어",
  "S-Shark": "S-샤크",
  "Vegapunk Punk-03 Edison": "베가펑크 펑크-03 에디슨",
  "Vegapunk Punk-04 Pythagoras": "베가펑크 펑크-04 피타고라스",
  "Vegapunk Punk-06 York": "베가펑크 펑크-06 요크",
  "Emet": "에메트",
  "Kujaku": "쿠자쿠",
  "Nefeltari Lily": "네펠타리 릴리",
  "Saint Figarland Garling": "피거랜드 갈링 성",
  "Ginny": "지니",
  "Shiki (Golden Lion)": "시키 (금사자)",
  "Joyboy": "조이보이",
  "Loki": "로키",
  "Saint Figarland Shamrock": "피거랜드 샴록 성",
  "Harald": "하랄드",
  "Saint Shepherd Sommers": "셰퍼드 서머스 성",
  "Saint Rimoshifu Killingham": "리모시프 킬링햄 성",
  "Rocks D. Xebec (Davy D. Xebec)": "록스 D. 지벡 (데이비 D. 지벡)",
  "Wang Zhi": "왕 직",
  "Mansion Guards": "저택 경비병",
  "Mrs. Chicken": "미세스 치킨",
  "News Coo": "뉴스 쿠",
  "Pinky The Bird": "괴조 핑키",
  "Transponder Snail": "전보벌레",
  "Trafalgar D. Water Law": "트라팔가 D. 워텔 로",
  "Trafalgar Law": "트라팔가 로"
}));

const CHO = {
  "": 11, b: 7, bb: 8, ch: 14, d: 3, dd: 4, f: 17, g: 0, gg: 1, h: 18,
  j: 12, jj: 13, k: 15, l: 5, m: 6, n: 2, p: 17, pp: 8, r: 5, s: 9,
  ss: 10, sh: 9, t: 16, th: 16, ts: 14, v: 7, w: 11, y: 11, z: 12
};
const JUNG = {
  a: 0, ae: 1, ai: 1, ya: 2, e: 5, ea: 5, ee: 20, ei: 5, eo: 4, eu: 18,
  i: 20, o: 8, oa: 9, oe: 11, oi: 11, oo: 13, ou: 8, u: 13, ui: 19, yu: 17
};
const JONG = { b: 17, d: 7, g: 1, k: 1, l: 8, m: 16, n: 4, ng: 21, p: 17, r: 8, s: 19, t: 7 };

async function main() {
  const source = await fs.readFile(DATA_PATH, "utf8");
  const data = loadData(source);
  const titles = unique(data.people.map((person) => person.wikiTitle).filter(Boolean));
  const langlinks = await loadKoLanglinks(titles);
  const entries = data.people.map((person) => {
    const existing = cleanName(person.nameKo);
    const fandomKo = cleanKoTitle(langlinks[person.wikiTitle]);
    const exact = EXACT_OVERRIDES.get(person.sourceNameEn) || EXACT_OVERRIDES.get(person.wikiTitle);
    const nameKo = existing || fandomKo || exact || koreanizePersonName(person);
    return {
      id: person.id,
      sourceNameEn: person.sourceNameEn,
      sourceNameJa: person.sourceNameJa,
      wikiTitle: person.wikiTitle,
      nameKo,
      method: existing ? "existing" : fandomKo ? "fandom-ko-langlink" : exact ? "exact-override" : "auto-transliteration"
    };
  });

  const names = Object.fromEntries(entries.map((entry) => [entry.id, entry.nameKo]));
  const report = {
    generatedAt: new Date().toISOString(),
    total: entries.length,
    byMethod: countBy(entries, "method"),
    withoutHangul: entries.filter((entry) => !/[가-힣]/.test(entry.nameKo)),
    entries
  };
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (apply) {
    await fs.writeFile(DATA_PATH, replaceNameBlock(source, names), "utf8");
  }

  console.log(JSON.stringify({
    total: report.total,
    byMethod: report.byMethod,
    withoutHangul: report.withoutHangul.length,
    applied: apply,
    reportPath: path.relative(ROOT, REPORT_PATH)
  }, null, 2));
}

function loadData(source) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: DATA_PATH });
  return sandbox.window.onePieceData;
}

async function loadKoLanglinks(titles) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  const cache = await readJson(CACHE_PATH, {});
  const missing = refresh ? titles : titles.filter((title) => !(title in cache));
  for (let index = 0; index < missing.length; index += 50) {
    const batch = missing.slice(index, index + 50);
    const fetched = await fetchKoLanglinkBatch(batch);
    for (const title of batch) cache[title] = fetched[title] || "";
    await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  }
  return cache;
}

async function fetchKoLanglinkBatch(titles) {
  if (!titles.length) return {};
  const params = new URLSearchParams({
    action: "query",
    prop: "langlinks",
    lllang: "ko",
    format: "json",
    titles: titles.join("|"),
    origin: "*"
  });
  const response = await fetch(`${API}?${params.toString()}`);
  if (!response.ok) throw new Error(`Fandom API failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  const normalizedMap = new Map((json.query?.normalized || []).map((entry) => [normalizeTitle(entry.from), entry.to]));
  const pages = Object.values(json.query?.pages || {});
  const byTitle = new Map(pages.map((page) => [normalizeTitle(page.title), page]));
  const result = {};
  for (const originalTitle of titles) {
    const normalized = normalizedMap.get(normalizeTitle(originalTitle)) || originalTitle;
    const page = byTitle.get(normalizeTitle(normalized)) || byTitle.get(normalizeTitle(originalTitle));
    result[originalTitle] = page?.langlinks?.find((link) => link.lang === "ko")?.["*"] || "";
  }
  return result;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function cleanKoTitle(value) {
  const text = cleanName(value)
    .replace(/\s*\((?:원피스|ONE PIECE|동음이의어)\)\s*$/i, "")
    .replace(/\/.*$/, "")
    .trim();
  return /[가-힣]/.test(text) ? text : "";
}

function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function koreanizePersonName(person) {
  const english = cleanName(person.sourceNameEn || person.wikiTitle || person.nameEn);
  if (english) return koreanizeEnglishName(english);
  return koreanizeEnglishName(cleanName(person.sourceNameJa || person.name || person.id));
}

function koreanizeEnglishName(name) {
  const exact = EXACT_OVERRIDES.get(name);
  if (exact) return exact;
  const primary = name.replace(/\s*\(([^)]*)\)\s*/g, (_, inner) => ` (${koreanizeEnglishName(inner)}) `);
  return primary
    .split(/(\s+|[-/·&,.])/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      if (/^[-/·&,.]$/.test(part)) return part === "&" ? "와" : part;
      const trimmed = part.trim();
      if (/^\([^)]*\)$/.test(trimmed)) return trimmed;
      if (/^\d+$/.test(trimmed)) return trimmed;
      if (/^[A-Z]{1,4}\d*$/.test(trimmed)) return koreanizeAbbreviation(trimmed);
      return romanWordToHangul(trimmed);
    })
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+([-/·&,.])/g, "$1")
    .replace(/([-/·&,.])\s+/g, "$1")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
}

function romanWordToHangul(word) {
  const normalized = word
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  if (!normalized) return word;
  const lower = normalized.toLowerCase();
  if (WORD_OVERRIDES.has(lower)) return WORD_OVERRIDES.get(lower);
  if (/^\d+$/.test(normalized)) return normalized;
  if (/^[A-Z]{1,4}\d*$/.test(normalized)) return koreanizeAbbreviation(normalized);

  let text = lower
    .replace(/ck/g, "k")
    .replace(/ph/g, "f")
    .replace(/qu/g, "kw")
    .replace(/x/g, "ks");
  if (text.endsWith("er")) text = `${text.slice(0, -2)}eo`;
  if (text.endsWith("or")) text = `${text.slice(0, -2)}o`;
  if (text.endsWith("y")) text = `${text.slice(0, -1)}i`;
  if (text.length > 3 && text.endsWith("e") && !/[aeiou]e$/.test(text)) text = text.slice(0, -1);

  const syllables = [];
  let i = 0;
  while (i < text.length) {
    const initial = readInitial(text, i);
    i += initial.raw.length;
    const vowel = readVowel(text, i);
    if (!vowel) {
      syllables.push(consonantTail(initial.raw || text[i] || ""));
      if (!initial.raw) i += 1;
      continue;
    }
    i += vowel.raw.length;
    let final = "";
    if (i < text.length) {
      const nextVowelIndex = findNextVowel(text, i);
      const consonants = text.slice(i, nextVowelIndex < 0 ? text.length : nextVowelIndex);
      if (nextVowelIndex >= 0 && consonants.length >= 2) {
        const bridge = consonants.startsWith("ng") ? "ng" : consonants[0];
        final = finalConsonant(bridge);
        if (final) i += bridge.length;
      } else if (nextVowelIndex < 0 && consonants.length <= 2) {
        final = finalConsonant(consonants);
        i += consonants.length;
      }
    }
    syllables.push(compose(initial.key, vowel.key, final));
  }
  return syllables.join("").replace(/으([aeiou])/g, "$1");
}

function readInitial(text, index) {
  const rest = text.slice(index);
  const initials = ["ch", "sh", "th", "ts", "bb", "dd", "gg", "jj", "pp", "ss"];
  const found = initials.find((item) => rest.startsWith(item));
  if (found) return { raw: found, key: found };
  const char = rest[0] || "";
  if ("bcdfghjklmnpqrstvwxyz".includes(char)) return { raw: char, key: char };
  return { raw: "", key: "" };
}

function readVowel(text, index) {
  const rest = text.slice(index);
  const vowels = ["ae", "ai", "ea", "ee", "ei", "eo", "eu", "oa", "oe", "oi", "oo", "ou", "ui", "ya", "yu", "a", "e", "i", "o", "u", "y"];
  const found = vowels.find((item) => rest.startsWith(item));
  if (!found) return null;
  if (found === "y") return { raw: found, key: "i" };
  return { raw: found, key: JUNG[found] === undefined ? found[0] : found };
}

function findNextVowel(text, index) {
  for (let i = index; i < text.length; i += 1) {
    if ("aeiouy".includes(text[i])) return i;
  }
  return -1;
}

function finalConsonant(value) {
  if (!value) return "";
  if (JONG[value]) return value;
  if (value.endsWith("ng")) return "ng";
  const last = value.at(-1);
  return JONG[last] ? last : "";
}

function consonantTail(value) {
  const map = {
    bb: "브", dd: "드", gg: "그", pp: "프", ss: "스", ts: "츠",
    b: "브", c: "크", ch: "치", d: "드", f: "프", g: "그", h: "흐", j: "지",
    k: "크", l: "르", m: "므", n: "느", p: "프", r: "르", s: "스", sh: "시",
    t: "트", th: "스", v: "브", w: "우", x: "크스", y: "이", z: "즈"
  };
  return map[value] || value;
}

function compose(initial, vowel, final = "") {
  const cho = CHO[initial] ?? CHO[initial[0]] ?? 11;
  const jung = JUNG[vowel] ?? JUNG[vowel[0]] ?? 0;
  const jong = JONG[final] || 0;
  return String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
}

function koreanizeAbbreviation(value) {
  const letters = {
    A: "에이", B: "비", C: "시", D: "D", E: "이", F: "에프", G: "G",
    H: "에이치", I: "아이", J: "J", K: "케이", L: "엘", M: "엠",
    N: "엔", O: "오", P: "피", Q: "큐", R: "알", S: "S", T: "티",
    U: "유", V: "V", W: "더블유", X: "X", Y: "와이", Z: "Z"
  };
  return value.replace(/[A-Z]/g, (letter) => letters[letter] || letter);
}

function replaceNameBlock(source, names) {
  const block = `${START_MARKER}
(() => {
  const data = window.onePieceData;
  const koreanNames = ${JSON.stringify(names, null, 4)};
  Object.entries(koreanNames).forEach(([id, nameKo]) => {
    const person = data.people.find((item) => item.id === id);
    if (person && !person.nameKo) person.nameKo = nameKo;
  });
})();
${END_MARKER}`;
  const pattern = new RegExp(`${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}`);
  if (pattern.test(source)) return source.replace(pattern, block);
  return `${source.trimEnd()}\n\n${block}\n`;
}

function countBy(entries, key) {
  return entries.reduce((acc, entry) => {
    acc[entry[key]] = (acc[entry[key]] || 0) + 1;
    return acc;
  }, {});
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeTitle(value) {
  return String(value || "").replace(/_/g, " ").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
