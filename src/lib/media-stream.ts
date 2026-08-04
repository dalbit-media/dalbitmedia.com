import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";

export const STREAM_REVALIDATE_SECONDS = 30 * 60;

export type Platform = "YouTube" | "Instagram" | "TikTok" | "X" | "Facebook" | "검색 트렌드" | "국내 뉴스" | "국내 커뮤니티";

export type TrendMetric = {
  label: string;
  value: number;
};

export type StreamItem = {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
  description?: string;
  trendScore: number;
  trendMetrics: TrendMetric[];
};

export type StreamData = {
  items: StreamItem[];
  updatedAt: string;
  activeSources: number;
  totalSources: number;
  inactiveSources: string[];
};

type FeedSource = {
  name: string;
  platform: Platform;
  url: string;
  type: "atom" | "google-trends" | "google-news-site" | "naver-news" | "nate-news";
  encoding?: "euc-kr";
};

type CommunitySource = {
  name: string;
  url: string;
  linkSelector: string;
  linkPattern: RegExp;
  ranked?: boolean;
  encoding?: "euc-kr";
};

const youtubeChannels = [
  ["HYBE LABELS", "UC3IZKseVpdzPSBaWxBxundA"],
  ["SMTOWN", "UCEf_Bc-KVd7onSeifS3py9g"],
  ["JYP Entertainment", "UCaO6TYtlC8U5ttz62hTrZgg"],
  ["MBCkpop", "UCe52oeb7Xv_KaJsEzcKXJJg"],
] as const;

const communitySources: CommunitySource[] = [
  { name: "DCInside", url: "https://gall.dcinside.com/board/lists/?id=dcbest", linkSelector: 'tr.ub-content.us-post a[href*="/board/view/"]', linkPattern: /\/board\/view\// },
  { name: "더쿠", url: "https://theqoo.net/hot/category/2987494600", linkSelector: 'td.title a[href^="/hot/"]', linkPattern: /\/hot\/\d+/ },
  { name: "인스티즈", url: "https://www.instiz.net/pt", linkSelector: 'td.listsubject a[href*="/pt/"]', linkPattern: /\/pt\/\d+/ },
  { name: "네이트 판 랭킹", url: "https://pann.nate.com/talk/ranking", linkSelector: 'li h2 a[href^="/talk/"]', linkPattern: /\/talk\/\d+$/, ranked: true },
  { name: "82cook 자유게시판", url: "https://www.82cook.com/entiz/enti.php?bn=15", linkSelector: 'tr:not(.noticeList) td.title > a[href*="read.php?bn=15"]', linkPattern: /read\.php\?bn=15&num=\d+/ },
  { name: "디미토리 이슈", url: "https://www.dmitory.com/issue", linkSelector: 'tr:not(.notice) a.hx[href^="https://www.dmitory.com/issue/"]', linkPattern: /\/issue\/\d+$/ },
  { name: "클리앙", url: "https://www.clien.net/service/group/clien_all?od=T33", linkSelector: "div.list_item.symph_row a.list_subject", linkPattern: /\/service\/board\/[^/]+\/\d+/ },
  { name: "루리웹", url: "https://bbs.ruliweb.com/best/all", linkSelector: 'a.subject_link[href*="/read/"]', linkPattern: /\/read\/\d+/ },
  { name: "뽐뿌 HOT", url: "https://www.ppomppu.co.kr/hot.php?id=freeboard", linkSelector: "a.baseList-title", linkPattern: /\/zboard\/zboard\.php\?id=[^&]+&no=\d+/, ranked: true, encoding: "euc-kr" },
  { name: "MLBPark 베스트", url: "https://mlbpark.donga.com/mp/b.php?b=bullpen&m=best", linkSelector: 'a.txt[href*="b=bullpen"][href*="m=view"]', linkPattern: /[?&]id=\d+/, ranked: true },
  { name: "보배드림 베스트", url: "https://www.bobaedream.co.kr/list?code=best", linkSelector: 'a.bsubject[href^="/view?code=best"]', linkPattern: /[?&]No=\d+/, ranked: true },
];

const sources: FeedSource[] = [
  ...youtubeChannels.map(([name, channelId]) => ({
    name,
    platform: "YouTube" as const,
    type: "atom" as const,
    url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  })),
  { name: "Google Trends KR", platform: "검색 트렌드", type: "google-trends", url: "https://trends.google.com/trending/rss?geo=KR" },
  { name: "에펨코리아", platform: "국내 커뮤니티", type: "google-news-site", url: `https://news.google.com/rss/search?q=${encodeURIComponent("site:fmkorea.com")}&hl=ko&gl=KR&ceid=KR:ko` },
  { name: "네이버 많이 본 뉴스", platform: "국내 뉴스", type: "naver-news", url: "https://news.naver.com/main/ranking/popularDay.naver", encoding: "euc-kr" },
  { name: "네이트 관심뉴스", platform: "국내 뉴스", type: "nate-news", url: "https://news.nate.com/rank/interest", encoding: "euc-kr" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]);
  return "";
}

function metricValue(value: string | undefined): number {
  return Number((value ?? "").replace(/[^0-9]/g, "")) || 0;
}

function normalizedDescription(value: string, title = "") {
  const normalized = value.replace(/\s+/g, " ").trim();
  const withoutTitle = title && normalized.startsWith(title) ? normalized.slice(title.length).trim() : normalized;
  if (!withoutTitle || withoutTitle === title) return undefined;
  const descriptionKey = normalizedStreamTitle(withoutTitle);
  const titleKey = normalizedStreamTitle(title);
  if (titleKey && (titleKey.startsWith(descriptionKey) || descriptionKey.startsWith(titleKey))) return undefined;
  return withoutTitle.length > 220 ? `${withoutTitle.slice(0, 217).trimEnd()}...` : withoutTitle;
}

export function calculateTrendScore(metrics: TrendMetric[], publishedAt: string, now = Date.now()): number {
  const weights: Record<string, [number, number]> = {
    조회: [0.45, 500_000],
    추천: [0.35, 5_000],
    좋아요: [0.35, 50_000],
    댓글: [0.2, 3_000],
    검색량: [1, 100_000],
  };
  let weightedScore = 0;
  let totalWeight = 0;
  const ageDays = Math.max(1, (now - Date.parse(publishedAt)) / 86_400_000);

  for (const metric of metrics) {
    const config = weights[metric.label];
    if (!config || metric.value <= 0) continue;
    const [weight, benchmark] = config;
    const dailyValue = metric.value / ageDays;
    weightedScore += Math.min(1, Math.log10(dailyValue + 1) / Math.log10(benchmark + 1)) * weight;
    totalWeight += weight;
  }

  if (!totalWeight) return 0;
  const recencyFactor = 0.45 + 0.55 * Math.pow(0.5, ageDays / 7);
  return Math.round((weightedScore / totalWeight) * recencyFactor * 100);
}

export function isRankedItem(metrics: TrendMetric[]) {
  return metrics.some((metric) => metric.label === "인기 순위" || metric.label === "조회 순위");
}

export function isIndexedItem(metrics: TrendMetric[]) {
  return metrics.some((metric) => metric.label === "공개 인덱스");
}

export function isStreamItemEligible(item: Pick<StreamItem, "trendMetrics" | "trendScore">) {
  return isRankedItem(item.trendMetrics) || isIndexedItem(item.trendMetrics) || item.trendScore >= 35;
}

async function responseText(response: Response, encoding?: "euc-kr") {
  if (!encoding) return response.text();
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}

function normalizedPreviewImage(value: string | undefined, source: FeedSource) {
  if (!value) return undefined;
  const url = new URL(value, source.url).toString();
  if (source.type === "naver-news") {
    const highQualityUrl = new URL(url);
    highQualityUrl.searchParams.set("type", "w800");
    return highQualityUrl.toString();
  }
  if (source.type !== "nate-news") return url;
  const originPath = url.match(/\/\/news\.nateimg\.co\.kr\/(.+)$/)?.[1];
  return originPath ? `https://news.nateimg.co.kr/${originPath}` : undefined;
}

export function canonicalStreamUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const parameter of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(parameter)) url.searchParams.delete(parameter);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

export function normalizedStreamTitle(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function parseKoreanPublishedAt(raw: string, collectedAt: string): string {
  if (!raw) return collectedAt;
  const collected = new Date(collectedAt);
  const koreanParts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(collected).map((part) => [part.type, part.value]));
  let localTimestamp = raw.replace(/\s+/g, " ").trim();
  if (/^\d{2}:\d{2}$/.test(localTimestamp)) {
    localTimestamp = `${koreanParts.year}-${koreanParts.month}-${koreanParts.day} ${localTimestamp}`;
  } else if (/^\d{2}\.\d{2}\s+\d{2}:\d{2}$/.test(localTimestamp)) {
    localTimestamp = `${koreanParts.year}-${localTimestamp.replace(".", "-")}`;
  }
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(localTimestamp);
  const parsed = Date.parse(hasTimeZone ? localTimestamp : `${localTimestamp.replace(" ", "T")}+09:00`);
  return Number.isNaN(parsed) || parsed > collected.getTime() + 3_600_000 ? collectedAt : new Date(parsed).toISOString();
}

function relativePublishedAt(raw: string, collectedAt: number) {
  const match = raw.match(/(\d+)\s*(분|시간|일)전/);
  if (!match) return undefined;
  const unit = match[2] === "분" ? 60_000 : match[2] === "시간" ? 3_600_000 : 86_400_000;
  return new Date(collectedAt - Number(match[1]) * unit).toISOString();
}

async function fetchDetailPublishedAt(url: string, source: CommunitySource | FeedSource) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DalbitMedia-Stream/1.0; +https://dalbitmedia.com)" },
      next: { revalidate: STREAM_REVALIDATE_SECONDS },
    });
    if (!response.ok) return undefined;
    const html = await responseText(response, source.encoding);
    if (source.name === "네이트 관심뉴스") {
      return html.match(/class="firstDate"[^>]*>기사전송\s*<em>([^<]+)<\/em>/)?.[1];
    }
    const $ = load(html);
    if (source.name === "뽐뿌 HOT") {
      return html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ?? $("li").filter((_, element) => $(element).text().includes("등록일")).first().text().replace("등록일", "").trim();
    }
    if (source.name === "MLBPark 베스트") {
      return $(".val").map((_, element) => $(element).text().trim()).get().find((value) => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(value));
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchSource(source: FeedSource): Promise<StreamItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": "DalbitMedia-Stream/1.0 (+https://dalbitmedia.com)" },
    next: { revalidate: STREAM_REVALIDATE_SECONDS },
  });

  if (!response.ok) throw new Error(`${source.name}: ${response.status}`);

  if (source.type === "naver-news" || source.type === "nate-news") {
    const $ = load(await responseText(response, source.encoding));
    const selector = source.type === "naver-news" ? "a.list_title[href*=RANKING]" : 'a[href*="/view/"]';
    const seen = new Set<string>();
    const items: StreamItem[] = [];
    const collectedAt = Date.now();
    $(selector).each((_, element) => {
      const href = $(element).attr("href") ?? "";
      const url = new URL(href, source.url).toString();
      const title = (source.type === "nate-news" ? $(element).find("h2.tit").text() : $(element).text()).replace(/\s+/g, " ").trim();
      if (!title || seen.has(url) || items.length >= 8) return;
      seen.add(url);
      const rank = items.length + 1;
      const row = $(element).closest("li, div.mlt01");
      const image = row.find("img").first().attr("src");
      const description = source.type === "nate-news" ? normalizedDescription(row.find(".tb").text(), title) : undefined;
      const rowTime = source.type === "naver-news" ? row.find(".list_time").text().trim() : "";
      const publishedAt = relativePublishedAt(rowTime, collectedAt) ?? new Date(collectedAt).toISOString();
      const trendMetrics = [{ label: "조회 순위", value: rank }];
      if (source.type === "nate-news") trendMetrics.push({ label: "작성 시각 미제공", value: 0 });
      items.push({
        id: `${source.platform}-${url}`,
        platform: source.platform,
        title,
        url,
        source: source.name,
        publishedAt,
        image: normalizedPreviewImage(image, source),
        description,
        trendScore: calculateTrendScore(trendMetrics, publishedAt),
        trendMetrics,
      });
    });
    if (source.type === "nate-news") {
      await Promise.all(items.map(async (item) => {
        const raw = await fetchDetailPublishedAt(item.url, source);
        if (!raw) return;
        item.publishedAt = parseKoreanPublishedAt(raw, new Date(collectedAt).toISOString());
        item.trendMetrics = item.trendMetrics.filter((metric) => metric.label !== "작성 시각 미제공");
      }));
    }
    return items;
  }

  if (source.type === "google-trends") {
    const parsed = parser.parse(await response.text());
    return asArray<Record<string, unknown>>(parsed.rss?.channel?.item).slice(0, 24).map((item) => {
      const title = text(item.title);
      const publishedAt = text(item.pubDate);
      const trendMetrics = [{ label: "검색량", value: metricValue(text(item.approx_traffic)) }];
      const relatedNews = asArray<Record<string, unknown>>(item.news_item as Record<string, unknown> | Record<string, unknown>[] | undefined);
      return {
        id: `Google-Trends-${title}`,
        platform: source.platform,
        title,
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=KR`,
        source: source.name,
        publishedAt,
        image: text(item.picture) || undefined,
        description: normalizedDescription(text(relatedNews[0]?.news_item_title), title),
        trendScore: calculateTrendScore(trendMetrics, publishedAt),
        trendMetrics,
      };
    });
  }

  if (source.type === "google-news-site") {
    const parsed = parser.parse(await response.text());
    return asArray<Record<string, unknown>>(parsed.rss?.channel?.item).slice(0, 8).map((item) => {
      const title = text(item.title).replace(/\s+-\s+에펨코리아$/, "").trim();
      const publishedAt = text(item.pubDate);
      const trendMetrics = [{ label: "공개 인덱스", value: 0 }];
      return {
        id: `Google-News-${text(item.guid) || text(item.link)}`,
        platform: source.platform,
        title,
        url: text(item.link),
        source: source.name,
        publishedAt,
        trendScore: 0,
        trendMetrics,
      };
    });
  }

  const parsed = parser.parse(await response.text());
  if (source.type === "atom") {
    return asArray<Record<string, unknown>>(parsed.feed?.entry).slice(0, 15).map((entry) => {
      const group = entry.group as { thumbnail?: { url?: string }; description?: string; community?: { statistics?: { views?: string }; starRating?: { count?: string } } } | undefined;
      const trendMetrics = [
        { label: "조회", value: metricValue(group?.community?.statistics?.views) },
        { label: "좋아요", value: metricValue(group?.community?.starRating?.count) },
      ].filter((metric) => metric.value > 0);
      return {
        id: `${source.platform}-${text(entry.videoId)}`,
        platform: source.platform,
        title: text(entry.title),
        url: typeof entry.link === "object" && entry.link ? String((entry.link as { href?: string }).href ?? "") : "",
        source: source.name,
        publishedAt: text(entry.published),
        image: group?.thumbnail?.url,
        description: normalizedDescription(text(group?.description), text(entry.title)),
        trendScore: calculateTrendScore(trendMetrics, text(entry.published)),
        trendMetrics,
      };
    });
  }
  return [];
}

async function fetchCommunitySource(source: CommunitySource): Promise<StreamItem[]> {
  const request = () => fetch(source.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DalbitMedia-Stream/1.0; +https://dalbitmedia.com)" },
    next: { revalidate: STREAM_REVALIDATE_SECONDS },
  });
  let response = await request();
  if (!response.ok) response = await request();

  if (!response.ok) throw new Error(`${source.name}: ${response.status}`);

  const $ = load(await responseText(response, source.encoding));
  const collectedAt = new Date().toISOString();
  const items: StreamItem[] = [];

  $(source.linkSelector).each((_, element) => {
    if (source.ranked && items.length >= 8) return;
    const href = $(element).attr("href") ?? "";
    const title = $(element).text().replace(/\s+/g, " ").replace(/^\d+\s+/, "").replace(/\s*\[?\d+\]?$/, "").trim();
    if (!source.linkPattern.test(href) || title.length < 5 || /^(공지|추천\s*\d+|\[마감\])/.test(title)) return;

    const row = $(element).closest("tr, li, div.list_item");
    if (source.name === "더쿠" && row.hasClass("notice")) return;
    let trendMetrics: TrendMetric[] = [];
    if (source.name === "DCInside") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".gall_count").text()) },
        { label: "추천", value: metricValue(row.find(".gall_recommend").text()) },
        { label: "댓글", value: metricValue(row.find(".reply_num").text()) },
      ];
    } else if (source.name === "더쿠") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".m_no").text()) },
        { label: "댓글", value: metricValue(row.find(".replyNum").text()) },
      ];
    } else if (source.name === "인스티즈") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".listno").eq(1).text()) },
        { label: "추천", value: metricValue(row.find(".listno").eq(2).text()) },
        { label: "댓글", value: metricValue(row.find(".cmt3").attr("title")) },
      ];
    } else if (source.name === "네이트 판 랭킹") {
      trendMetrics = [
        { label: "인기 순위", value: metricValue(row.find(".rankNum span span").text()) },
        { label: "조회", value: metricValue(row.find(".count").text()) },
        { label: "추천", value: metricValue(row.find(".rcm").text()) },
        { label: "댓글", value: metricValue(row.find(".reple-num").text()) },
      ];
    } else if (source.name === "82cook 자유게시판") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find("td.numbers").last().text()) },
        { label: "댓글", value: metricValue(row.find("td.title em").text()) },
      ];
    } else if (source.name === "디미토리 이슈") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".m_no").text()) },
        { label: "댓글", value: metricValue(row.find(".replyNum").text()) },
      ];
    } else if (source.name === "클리앙") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".list_hit .hit").text()) },
        { label: "추천", value: metricValue(row.find(".list_symph span").text()) },
        { label: "댓글", value: metricValue(row.find(".list_reply span").text()) },
      ];
    } else if (source.name === "루리웹") {
      trendMetrics = [
        { label: "조회", value: metricValue(row.find(".hit").text()) },
        { label: "추천", value: metricValue(row.find(".recomd").text()) },
        { label: "댓글", value: metricValue(row.find(".num_reply").text()) },
      ];
    }
    trendMetrics = trendMetrics.filter((metric) => metric.value > 0);
    if (source.ranked && trendMetrics.length === 0) trendMetrics = [{ label: "인기 순위", value: items.length + 1 }];

    const url = new URL(href, source.url).toString();
    const rawPublishedAt = source.name === "DCInside" ? row.find(".gall_date").attr("title") ?? ""
      : source.name === "더쿠" || source.name === "루리웹" ? row.find(".time").first().text()
        : source.name === "인스티즈" ? row.find(".listno").first().text()
          : source.name === "82cook 자유게시판" ? row.find(".regdate").attr("title") ?? row.find(".regdate").text()
            : source.name === "디미토리 이슈" ? row.find(".time").text()
          : source.name === "클리앙" ? row.find(".timestamp").first().text()
            : source.name === "보배드림 베스트" ? row.find(".date").first().text()
            : "";
    const publishedAt = parseKoreanPublishedAt(rawPublishedAt, collectedAt);
    if (!rawPublishedAt) trendMetrics.push({ label: "작성 시각 미제공", value: 0 });
    if (items.some((item) => item.url === url)) return;
    items.push({
      id: `community-${source.name}-${url}`,
      platform: "국내 커뮤니티",
      title,
      url,
      source: source.name,
      publishedAt,
      description: source.name === "네이트 판 랭킹" ? normalizedDescription(row.find(".txt").text(), title) : undefined,
      trendScore: calculateTrendScore(trendMetrics, publishedAt),
      trendMetrics,
    });
  });

  if (source.name === "뽐뿌 HOT" || source.name === "MLBPark 베스트") {
    await Promise.all(items.map(async (item) => {
      const raw = await fetchDetailPublishedAt(item.url, source);
      if (!raw) return;
      item.publishedAt = parseKoreanPublishedAt(raw, collectedAt);
      item.trendMetrics = item.trendMetrics.filter((metric) => metric.label !== "작성 시각 미제공");
    }));
  }

  return items.filter(isStreamItemEligible).sort((left, right) => right.trendScore - left.trendScore).slice(0, 8);
}

export async function collectMediaStream(): Promise<StreamData> {
  const youtubeSources = sources.filter((source) => source.type === "atom");
  const socialSources = sources.filter((source) => source.type !== "atom");
  const results: PromiseSettledResult<StreamItem[]>[] = await Promise.allSettled(youtubeSources.map(fetchSource));
  const inactiveSources = youtubeSources.filter((_, index) => results[index].status === "rejected").map((source) => source.name);

  for (const source of socialSources) {
    try {
      results.push({ status: "fulfilled", value: await fetchSource(source) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
      inactiveSources.push(source.name);
    }
  }

  for (const source of communitySources) {
    try {
      results.push({ status: "fulfilled", value: await fetchCommunitySource(source) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
      inactiveSources.push(source.name);
    }
  }

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const uniqueItems = results
    .filter((result): result is PromiseFulfilledResult<StreamItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((item) => item.title && item.url && isStreamItemEligible(item) && !Number.isNaN(Date.parse(item.publishedAt)))
    .map((item) => ({ ...item, url: canonicalStreamUrl(item.url), publishedAt: new Date(item.publishedAt).toISOString() }))
    .filter((item) => {
      const title = normalizedStreamTitle(item.title);
      if (seenUrls.has(item.url) || seenTitles.has(title)) return false;
      seenUrls.add(item.url);
      seenTitles.add(title);
      return true;
    })
    .sort((left, right) => right.trendScore - left.trendScore || Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
  return {
    items: uniqueItems,
    updatedAt: new Date().toISOString(),
    activeSources: results.filter((result) => result.status === "fulfilled").length,
    totalSources: sources.length + communitySources.length,
    inactiveSources,
  };
}