import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = path.join(ROOT, "tools", ".cache", "namu-techniques");
const BASE_URL = "https://namu.wiki/w/";

const SOURCES = new Map([
  ["Gomu Gomu no Mi/Techniques", ["몽키 D. 루피/기술"]],
  ["Three Sword Style", ["롤로노아 조로/기술"]],
  ["Black Leg Style", ["상디/기술", "상디(원피스)/기술", "상디/전투력", "상디(원피스)/전투력", "상디(원피스)"]],
  ["Fish-Man Karate", ["징베/기술", "징베/전투력", "어인 공수도", "징베"]],
  ["Electro", ["캐럿(원피스)/전투력", "캐럿(원피스)"]],
  ["Hasshoken", ["돈 사이/기술", "돈 사이/전투력", "팔충권", "돈 사이"]],
  ["Okama Kenpo", ["벤담(원피스)/기술", "엠포리오 이반코프/기술", "뉴하프 권법", "오카마 권법", "벤담(원피스)/전투력", "엠포리오 이반코프/전투력", "벤담(원피스)"]],
  ["Ope Ope no Mi", ["수술수술 열매"]],
  ["Mero Mero no Mi", ["보아 행콕/기술", "매료매료 열매"]],
  ["Hana Hana no Mi", ["니코 로빈/기술", "꽃꽃 열매"]],
  ["Yomi Yomi no Mi", ["브룩/기술", "부활부활 열매"]],
  ["Bara Bara no Mi", ["버기/기술", "동강동강 열매"]],
  ["Suna Suna no Mi", ["크로커다일/기술", "모래모래 열매"]],
  ["Goro Goro no Mi", ["에넬/기술", "번개번개 열매"]],
  ["Magu Magu no Mi", ["사카즈키/기술", "마그마그 열매"]],
  ["Hie Hie no Mi", ["쿠잔/기술", "얼음얼음 열매"]],
  ["Pika Pika no Mi", ["볼사리노/기술", "번쩍번쩍 열매"]],
  ["Gura Gura no Mi", ["에드워드 뉴게이트/기술", "흔들흔들 열매"]],
  ["Yami Yami no Mi", ["마샬 D. 티치/기술", "어둠어둠 열매"]],
  ["Ito Ito no Mi", ["돈키호테 도플라밍고/기술", "실실 열매"]],
  ["Mochi Mochi no Mi", ["샬롯 카타쿠리/기술", "쫀득쫀득 열매"]],
  ["Uo Uo no Mi, Model: Seiryu", ["카이도/기술", "물고기물고기 열매 모델 청룡", "물고기물고기 열매/환수종"]],
  ["Tori Tori no Mi, Model: Phoenix", ["마르코/기술", "새새 열매 모델 불사조", "새새 열매/환수종", "불사조 마르코/전투력"]],
  ["Nikyu Nikyu no Mi", ["바솔로뮤 쿠마/기술", "도톰도톰 열매"]],
  ["Jiki Jiki no Mi", ["유스타스 키드/기술", "자기자기 열매"]],
  ["Horo Horo no Mi", ["페로나/기술", "홀로홀로 열매"]],
  ["Doku Doku no Mi", ["마젤란(원피스)/기술", "마젤란/기술", "독독 열매"]],
  ["Soru Soru no Mi", ["샬롯 링링/기술", "소울소울 열매"]],
  ["Hobi Hobi no Mi", ["슈거(원피스)/기술", "슈거/기술", "하비하비 열매"]],
  ["Zushi Zushi no Mi", ["잇쇼/기술", "쿠궁쿠궁 열매"]],
  ["Mera Mera no Mi", ["포트거스 D. 에이스/기술", "사보/기술", "이글이글 열매"]],
  ["Koby", ["코비(원피스)/전투력", "코비(원피스)"]]
]);

await fs.mkdir(CACHE_DIR, { recursive: true });

const results = [];
for (const [sourceTitle, candidates] of SOURCES) {
  let matched = null;
  const matches = [];
  const attempts = [];
  for (const pageTitle of candidates) {
    const url = `${BASE_URL}${encodeURIComponent(pageTitle).replaceAll("%2F", "/")}`;
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; onepiece-technique-metadata-audit/1.0)"
        },
        redirect: "follow"
      });
      const html = await response.text();
      const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
      const exists = response.ok
        && html.length > 20_000
        && !/존재하지 않는 문서|문서를 찾을 수 없습니다|not_found_exception/i.test(html);
      attempts.push({ pageTitle, url, status: response.status, bytes: html.length, title, exists });
      if (!exists) continue;

      const fileName = `${safeName(sourceTitle)}--${safeName(pageTitle)}.html`;
      const filePath = path.join(CACHE_DIR, fileName);
      await fs.writeFile(filePath, html);
      matched = {
        sourceTitle,
        pageTitle,
        url: response.url || url,
        title,
        file: path.relative(ROOT, filePath),
        bytes: html.length
      };
      matches.push(matched);
    } catch (error) {
      attempts.push({ pageTitle, url, error: String(error.message || error), exists: false });
    }
  }
  results.push({ sourceTitle, matched: matches[0] || matched, matches, attempts });
  console.log(JSON.stringify({ sourceTitle, matched: matches.map((item) => item.pageTitle) }));
}

await fs.writeFile(
  path.join(CACHE_DIR, "index.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`
);

console.log(JSON.stringify({
  sources: SOURCES.size,
  matched: results.filter((item) => item.matched).length,
  unmatched: results.filter((item) => !item.matched).map((item) => item.sourceTitle)
}, null, 2));

function safeName(value) {
  return String(value || "").normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#x2F;/gi, "/")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
