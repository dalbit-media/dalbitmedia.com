import seeds from "../data/korean-proper-nouns.json";
import type { StreamItem } from "./media-stream";

export type ProperNounMatch = {
  normalized: string;
  displayName: string;
  seeded: boolean;
  seedRank?: number;
  seedViews?: number;
};

type SeedRecord = {
  rank: number;
  name: string;
  views: number;
};

type Candidate = ProperNounMatch & {
  frequency: number;
  strong: boolean;
};

const MAX_TAGS_PER_ITEM = 12;
const particles = ["으로부터", "에게서", "에서는", "으로는", "이라도", "이라고", "에서", "에게", "께서", "으로", "부터", "까지", "처럼", "보다", "하고", "이며", "이고", "의", "은", "는", "이", "가", "을", "를", "에", "와", "과", "도", "만", "로"];
const entitySuffixes = ["대통령", "의원", "장관", "감독", "선수", "배우", "가수", "작가", "그룹", "밴드", "대표", "총리", "정부", "기업", "방송", "대학", "병원", "재단", "협회", "위원회", "구단", "브랜드", "드라마", "영화", "게임", "시리즈"];
const koreanSurnames = "김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용";
const stopwords = new Set([
  "관련", "공개", "근황", "논란", "사실", "정도", "이유", "오늘", "내일", "어제", "이번", "지난", "현재", "최근", "당시", "결국", "진짜", "정말", "사람", "여성", "남성", "남자", "여자", "아이", "부모", "남편", "아내", "친구", "사진", "영상", "기사", "뉴스", "속보", "단독", "공식", "최초", "최고", "시작", "종료", "발표", "상황", "문제", "이야기", "생각", "댓글", "추천", "조회", "이벤트", "후기", "정보", "유머", "전체", "올해", "내년", "한국", "국내", "해외", "세계", "서울", "기준", "가능", "확인", "모습", "때문", "관련해", "대해서", "통해", "위해", "없는", "있는", "같은", "하는", "되는", "했다", "한다", "이라고", "그리고", "하지만", "그래서", "너무", "다시", "그냥", "아직", "무슨", "어떤", "우리", "자신", "이것", "저것", "그것", "마감", "시사회", "예고", "티저", "인터뷰", "무대", "방송", "신곡", "뮤직비디오", "영화", "요즘", "초대", "모공", "특징", "listen", "official", "teaser", "fancam", "young", "the", "mv", "jpg", "gif",
]);

export const koreanProperNounSeeds = seeds as SeedRecord[];

export function normalizeProperNoun(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/[_\s]+/g, " ").replace(/^[#@]+/, "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const compiledSeeds = koreanProperNounSeeds
  .map((seed) => {
    const normalized = normalizeProperNoun(seed.name);
    const particlePattern = particles.map(escapeRegExp).join("|");
    return {
      ...seed,
      normalized,
      pattern: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(normalized)}(?=$|[^\\p{L}\\p{N}]|(?:${particlePattern})(?=$|[^\\p{L}\\p{N}]))`, "iu"),
    };
  })
  .sort((left, right) => right.normalized.length - left.normalized.length || left.rank - right.rank);

function stripParticle(value: string) {
  if (!/^[가-힣]+$/.test(value)) return value;
  for (const particle of particles) {
    if (value.length > particle.length + 1 && value.endsWith(particle)) return value.slice(0, -particle.length);
  }
  return value;
}

function tokenCandidates(text: string) {
  const candidates: Array<{ normalized: string; displayName: string; strong: boolean }> = [];
  for (const match of text.normalize("NFKC").matchAll(/[“‘'"]([^”’'"]{2,30})[”’'"]/gu)) {
    const displayName = match[1].trim();
    const normalized = normalizeProperNoun(displayName);
    if (!stopwords.has(normalized) && /[가-힣A-Za-z]/.test(displayName)) candidates.push({ normalized, displayName, strong: true });
  }
  for (const match of text.normalize("NFKC").matchAll(/[#@]?[가-힣A-Za-z][가-힣A-Za-z0-9·&.+-]{1,29}/gu)) {
    const original = match[0];
    const displayName = stripParticle(original.replace(/^[#@]/, ""));
    const normalized = normalizeProperNoun(displayName);
    if (normalized.length < 2 || stopwords.has(normalized) || /^\d+$/.test(normalized) || /\.(?:jpe?g|gif|png|webp|com|net|org)$/i.test(normalized)) continue;
    const hasLatin = /[A-Za-z]/.test(displayName);
    if (hasLatin && /\d/.test(displayName) && !/[가-힣]/.test(displayName)) continue;
    const strong = /^[#@]/.test(original)
      || (hasLatin && ((/^[A-Z]{3,10}$/.test(displayName)) || (/[가-힣]/.test(displayName) && /[A-Z]/.test(displayName))))
      || (displayName.length === 3 && koreanSurnames.includes(displayName[0]) && /^[가-힣]+$/.test(displayName))
      || entitySuffixes.some((suffix) => displayName.length >= suffix.length + 2 && displayName.endsWith(suffix));
    candidates.push({ normalized, displayName, strong });
  }
  return candidates;
}

export function extractProperNouns(items: Array<Pick<StreamItem, "id" | "title" | "description">>) {
  const itemTexts = new Map(items.map((item) => [item.id, { title: item.title, full: `${item.title} ${item.description ?? ""}`.trim() }]));
  const discovered = new Map<string, Candidate>();

  for (const { title } of itemTexts.values()) {
    const seen = new Set<string>();
    for (const candidate of tokenCandidates(title)) {
      if (seen.has(candidate.normalized)) continue;
      seen.add(candidate.normalized);
      const existing = discovered.get(candidate.normalized);
      discovered.set(candidate.normalized, {
        normalized: candidate.normalized,
        displayName: existing?.displayName ?? candidate.displayName,
        seeded: false,
        frequency: (existing?.frequency ?? 0) + 1,
        strong: Boolean(existing?.strong || candidate.strong),
      });
    }
  }

  const result = new Map<string, ProperNounMatch[]>();
  for (const [itemId, text] of itemTexts) {
    const normalizedText = normalizeProperNoun(text.full);
    const matches = new Map<string, ProperNounMatch>();
    for (const seed of compiledSeeds) {
      if (!seed.pattern.test(normalizedText)) continue;
      matches.set(seed.normalized, {
        normalized: seed.normalized,
        displayName: seed.name,
        seeded: true,
        seedRank: seed.rank,
        seedViews: seed.views,
      });
    }
    for (const candidate of tokenCandidates(text.title)) {
      const batchCandidate = discovered.get(candidate.normalized);
      if (!batchCandidate?.strong || matches.has(candidate.normalized)) continue;
      matches.set(candidate.normalized, {
        normalized: candidate.normalized,
        displayName: batchCandidate.displayName,
        seeded: false,
      });
    }
    result.set(itemId, [...matches.values()]
      .sort((left, right) => Number(right.seeded) - Number(left.seeded) || (left.seedRank ?? 10000) - (right.seedRank ?? 10000) || right.displayName.length - left.displayName.length)
      .slice(0, MAX_TAGS_PER_ITEM));
  }
  return result;
}