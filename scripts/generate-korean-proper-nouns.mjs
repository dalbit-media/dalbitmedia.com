import fs from "node:fs/promises";
import path from "node:path";

const outputPath = path.join(process.cwd(), "src", "data", "korean-proper-nouns.json");
const completedDate = new Date();
completedDate.setUTCDate(completedDate.getUTCDate() - 1);

function normalizeArticle(value) {
  return decodeURIComponent(value)
    .replaceAll("_", " ")
    .replace(/\s*\([^)]*(?:년|동명이인|가수|배우|영화|드라마|방송인|정치인|축구 선수|야구 선수)[^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEligible(name) {
  return /[가-힣]/.test(name)
    && name.length >= 2
    && name.length <= 40
    && !/^(?:특수|위키백과|파일|틀|분류|포털|사용자|토론):/.test(name)
    && !/(?:목록|연표|동음이의어)$/.test(name)
    && !/^\d{1,4}(?:년|월|일)?$/.test(name);
}

const candidates = new Map();
for (let offset = 0; candidates.size < 4000 && offset < 45; offset += 1) {
  const date = new Date(completedDate);
  date.setUTCDate(date.getUTCDate() - offset);
  const datePath = date.toISOString().slice(0, 10).replaceAll("-", "/");
  const response = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ko.wikipedia.org/all-access/${datePath}`, {
    headers: { "User-Agent": "DalbitMedia-TrendSeeder/1.0 (https://dalbitmedia.com)" },
  });
  if (!response.ok) continue;
  const payload = await response.json();
  for (const article of payload.items?.[0]?.articles ?? []) {
    const name = normalizeArticle(article.article);
    if (!isEligible(name)) continue;
    const existing = candidates.get(name) ?? { name, articleTitle: article.article.replaceAll("_", " "), views: 0, dates: [] };
    existing.views += Number(article.views) || 0;
    existing.dates.push(datePath.replaceAll("/", "-"));
    candidates.set(name, existing);
  }
}

const candidateList = [...candidates.values()];
const entityIdsByName = new Map();
for (let index = 0; index < candidateList.length; index += 50) {
  const batch = candidateList.slice(index, index + 50);
  const parameters = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    titles: batch.map((candidate) => candidate.articleTitle).join("|"),
  });
  const response = await fetch("https://ko.wikipedia.org/w/api.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DalbitMedia-TrendSeeder/1.0 (https://dalbitmedia.com)",
    },
    body: parameters,
  });
  if (!response.ok) continue;
  const payload = await response.json();
  for (const page of payload.query?.pages ?? []) {
    const entityId = page.pageprops?.wikibase_item;
    if (entityId) entityIdsByName.set(normalizeArticle(page.title), entityId);
  }
}

const entityIds = [...new Set(entityIdsByName.values())];
const instanceEntityIds = new Set();
for (let index = 0; index < entityIds.length; index += 50) {
  const response = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${entityIds.slice(index, index + 50).join("|")}`, {
    headers: { "User-Agent": "DalbitMedia-TrendSeeder/1.0 (https://dalbitmedia.com)" },
  });
  if (!response.ok) continue;
  const payload = await response.json();
  for (const [entityId, entity] of Object.entries(payload.entities ?? {})) {
    if (Array.isArray(entity.claims?.P31) && entity.claims.P31.length > 0) instanceEntityIds.add(entityId);
  }
}

const seeds = candidateList
  .filter((candidate) => instanceEntityIds.has(entityIdsByName.get(candidate.name)))
  .sort((left, right) => right.views - left.views || left.name.localeCompare(right.name, "ko"))
  .slice(0, 1000)
  .map((seed, index) => ({ rank: index + 1, name: seed.name, views: seed.views, dates: seed.dates }));

if (seeds.length !== 1000 || new Set(seeds.map((seed) => seed.name.normalize("NFKC").toLocaleLowerCase("ko"))).size !== 1000) {
  throw new Error(`Expected 1,000 unique Korean proper nouns, received ${seeds.length}`);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(seeds, null, 2)}\n`, "utf8");
console.log(`Generated ${seeds.length} Korean proper-noun seeds at ${outputPath}`);