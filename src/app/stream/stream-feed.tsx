"use client";

import Image from "next/image";
import { type FormEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Camera, Clock3, Flame, LoaderCircle, MessageCircle, Music2, Newspaper, Search, Tag, Users, Video, X } from "lucide-react";
import type { Platform } from "@/lib/media-stream";
import type { StoredStreamPage } from "@/lib/stream-store";

const platformIcons = {
  YouTube: Video,
  Instagram: Camera,
  TikTok: Music2,
  X: MessageCircle,
  Facebook: Users,
  "검색 트렌드": Flame,
  "국내 뉴스": Newspaper,
  "국내 커뮤니티": Newspaper,
} satisfies Record<Platform, typeof Video>;

const platformClasses: Record<Platform, string> = {
  YouTube: "platform-youtube",
  Instagram: "platform-instagram",
  TikTok: "platform-tiktok",
  X: "platform-x",
  Facebook: "platform-facebook",
  "검색 트렌드": "platform-search-trend",
  "국내 뉴스": "platform-news",
  "국내 커뮤니티": "platform-community",
};

const sourceDomains: Record<string, string> = {
  "DCInside": "dcinside.com",
  "더쿠": "theqoo.net",
  "인스티즈": "instiz.net",
  "네이트 판 랭킹": "pann.nate.com",
  "82cook 자유게시판": "82cook.com",
  "디미토리 이슈": "dmitory.com",
  "클리앙": "clien.net",
  "루리웹": "ruliweb.com",
  "뽐뿌 HOT": "ppomppu.co.kr",
  "MLBPark 베스트": "mlbpark.donga.com",
  "보배드림 베스트": "bobaedream.co.kr",
  "아카라이브 싱글벙글": "arca.live",
  "에펨코리아": "fmkorea.com",
  "오늘의유머": "todayhumor.co.kr",
  "개드립": "dogdrip.net",
  "PGR21": "pgr21.com",
  "아카라이브": "arca.live",
  "나무위키": "namu.wiki",
  "네이버 많이 본 뉴스": "naver.com",
  "네이트 관심뉴스": "nate.com",
  "연합뉴스": "yna.co.kr",
  "SBS 뉴스": "sbs.co.kr",
  "Google Trends KR": "trends.google.com",
  "HYBE LABELS": "youtube.com",
  "SMTOWN": "youtube.com",
  "JYP Entertainment": "youtube.com",
  "MBCkpop": "youtube.com",
  "1theK (\uc6d0\ub354\ucf00\uc774)": "youtube.com",
  "Stone Music Entertainment": "youtube.com",
  "Mnet K-POP": "youtube.com",
  "STARSHIP ENTERTAINMENT": "youtube.com",
  "YouTube": "youtube.com",
  "검색 트렌드": "trends.google.com",
  "국내 뉴스": "naver.com",
};

const sourceDisplayNames: Record<string, string> = {
  "82cook 자유게시판": "82cook",
  "네이트 판 랭킹": "네이트 판",
  "보배드림 베스트": "보배드림",
  "MLBPark 베스트": "MLBPark",
  "뽐뿌 HOT": "뽐뿌",
  "디미토리 이슈": "디미토리",
  "아카라이브 싱글벙글": "아카라이브",
  "네이버 많이 본 뉴스": "네이버",
  "네이트 관심뉴스": "네이트",
  "SBS 뉴스": "SBS",
  "Google Trends KR": "Trends",
  "HYBE LABELS": "YouTube",
  "SMTOWN": "YouTube",
  "JYP Entertainment": "YouTube",
  "MBCkpop": "YouTube",
  "1theK (원더케이)": "YouTube",
  "Stone Music Entertainment": "YouTube",
  "Mnet K-POP": "YouTube",
  "STARSHIP ENTERTAINMENT": "YouTube",
};

function sourceDisplayName(name: string): string {
  return sourceDisplayNames[name] ?? name;
}

function sourceFaviconUrl(name: string): string | undefined {
  const domain = sourceDomains[name];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : undefined;
}

function relativeTime(date: string, referenceTime: number) {
  const elapsedMinutes = Math.max(0, Math.floor((referenceTime - Date.parse(date)) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}시간 전`;
  return `${Math.floor(elapsedHours / 24)}일 전`;
}

function storedTime(date: string, referenceTime: number) {
  const elapsedMinutes = Math.max(0, Math.floor((referenceTime - Date.parse(date)) / 60_000));
  if (elapsedMinutes < 60) return "최근 저장";
  if (elapsedMinutes < 24 * 60) return "얼마 전 저장";
  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(date))} 저장`;
}

function formatMetric(label: string, value: number) {
  if (label.endsWith("순위")) return `${value}위`;
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function hasKnownPublishedAt(metrics: StoredStreamPage["items"][number]["trendMetrics"]) {
  return !metrics.some((metric) => metric.label === "작성 시각 미제공");
}

const StreamCard = memo(function StreamCard({
  item,
  referenceTime,
  onFailedImage,
  onSelectTag,
  failedImages,
}: {
  item: StoredStreamPage["items"][number];
  referenceTime: number;
  onFailedImage: (image: string) => void;
  onSelectTag: (tag: string) => void;
  failedImages: Set<string>;
}) {
  const Icon = platformIcons[item.platform];
  const favicon = sourceFaviconUrl(item.source);
  const showImage = Boolean(item.image && !failedImages.has(item.image));
  const titleClass = showImage && item.title.length > 60 ? "stream-card-title-compact" : undefined;
  const visibleMetrics = item.trendMetrics.filter((metric) => metric.label !== "작성 시각 미제공" && metric.label !== "공개 인덱스");
  const activityClass = item.sourceScore >= 90
    ? " stream-card-activity stream-card-activity-strong"
    : item.sourceScore >= 75 ? " stream-card-activity" : "";

  return (
    <article className={`stream-card${showImage ? " stream-card-featured" : ""}${activityClass}`} key={item.id}>
      {showImage && item.image && (
        <a className="stream-card-image" href={item.url} target="_blank" rel="noreferrer" tabIndex={-1}>
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
            onError={() => onFailedImage(item.image!)}
            unoptimized
          />
        </a>
      )}
      <div className="stream-card-body">
        <div className="stream-card-meta">
          <span className={`platform-badge ${platformClasses[item.platform]}`}>
            {favicon
              ? <img src={favicon} alt="" width={12} height={12} className="source-favicon" loading="lazy" aria-hidden />
              : <Icon size={14} />}
            {sourceDisplayName(item.source)}
          </span>
          <span><Clock3 size={13} /> {hasKnownPublishedAt(item.trendMetrics) ? relativeTime(item.publishedAt, referenceTime) : storedTime(item.collectedAt, referenceTime)}</span>
        </div>
        <h2 className={titleClass}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h2>
        {item.description && <p className="stream-card-excerpt">{item.description}</p>}
        {item.tags.length > 0 && <div className="stream-card-tags" aria-label="고유명사 태그">
          {item.tags.map((tag) => <button key={tag.normalized} type="button" onClick={() => void onSelectTag(tag.normalized)}>#{tag.displayName}</button>)}
        </div>}
        {visibleMetrics.length > 0 && <div className="trend-metrics" aria-label="인기 및 반응 지표">
          {visibleMetrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><strong>{formatMetric(metric.label, metric.value)}</strong></span>)}
        </div>}
        <div className="stream-card-footer">
          <div className="hotness-gauge" aria-label={`${item.source} 내 상대 인기도 ${item.sourceScore}점`} title={`${item.source} 내 상대 인기도`}>
            <span className="hotness-gauge-label">HOT <strong>{item.sourceScore}</strong></span>
            <span className="hotness-gauge-bar" aria-hidden="true">
              {Array.from({ length: 20 }, (_, index) => <i className={index < item.sourceScore / 5 ? "filled" : ""} key={index} />)}
            </span>
          </div>
          <div className="stream-card-actions">
            <a href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.title} 원문 보기`}><ArrowUpRight size={19} /></a>
          </div>
        </div>
      </div>
    </article>
  );
});

async function requestStreamPage(filter: string, cursor?: string, search?: string, tag?: string) {
  const searchParams = new URLSearchParams();
  if (filter !== "전체") searchParams.set("filter", filter);
  if (cursor) searchParams.set("cursor", cursor);
  if (search) searchParams.set("q", search);
  if (tag) searchParams.set("tag", tag);
  const response = await fetch(`/api/stream?${searchParams}`);
  if (!response.ok) throw new Error("스트림을 불러오지 못했습니다.");
  return response.json() as Promise<StoredStreamPage>;
}

export function StreamFeed({ initialPage, initialSource, initialTag, renderedAt }: { initialPage: StoredStreamPage; initialSource: string; initialTag: string; renderedAt: string }) {
  const [items, setItems] = useState(initialPage.items);
  const [sources, setSources] = useState(initialPage.sources);
  const [selectedSource, setSelectedSource] = useState(initialSource);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTag, setActiveTag] = useState(initialTag);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedImages, setFailedImages] = useState(() => new Set<string>());
  const [referenceTime, setReferenceTime] = useState(() => Date.parse(renderedAt));
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);
  const loadingRef = useRef(loading);
  const koreanSources = useMemo(() => sources.filter((source) => source.platform === "국내 커뮤니티"), [sources]);
  const platformCounts = useMemo(() => sources
    .filter((source) => source.platform !== "국내 커뮤니티")
    .reduce((counts, source) => counts.set(source.platform, (counts.get(source.platform) ?? 0) + source.count), new Map<Platform, number>()), [sources]);
  const filterOptions = useMemo(() => [
    { key: "전체", count: sources.reduce((sum, source) => sum + source.count, 0) },
    ...koreanSources.map((source) => ({ key: source.source, count: source.count })),
    ...[...platformCounts].sort((left, right) => right[1] - left[1]).map(([platform, count]) => ({ key: platform, count })),
  ], [koreanSources, platformCounts, sources]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const interval = window.setInterval(() => setReferenceTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = [...grid.querySelectorAll<HTMLElement>(".stream-card")];
    const observer = new ResizeObserver((entries) => {
      const styles = getComputedStyle(grid);
      const rowHeight = Number.parseFloat(styles.gridAutoRows);
      const rowGap = Number.parseFloat(styles.rowGap);
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        card.style.gridRowEnd = `span ${Math.ceil((entry.contentRect.height + rowGap) / (rowHeight + rowGap))}`;
      }
    });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [failedImages, items]);

  const markFailedImage = useCallback((image: string) => {
    setFailedImages((current) => {
      if (current.has(image)) return current;
      const next = new Set(current);
      next.add(image);
      return next;
    });
  }, []);

  const loadPages = useCallback(async (nextCursor: string | null, nextSource = selectedSource, nextSearch = activeSearch, nextTag = activeTag) => {
    if (!nextCursor || loadingRef.current) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const page = await requestStreamPage(nextSource, nextCursor, nextSearch, nextTag);
      if (version !== requestVersion.current) return;
      setItems((current) => {
        const urls = new Set(current.map((item) => item.url));
        return [...current, ...page.items.filter((item) => !urls.has(item.url))];
      });
      setCursor(page.nextCursor);
      setSources(page.sources);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError instanceof Error ? requestError.message : "스트림을 불러오지 못했습니다.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [activeSearch, activeTag, selectedSource]);

  async function selectSource(source: string) {
    if (source === selectedSource || loadingRef.current) return;
    const version = ++requestVersion.current;
    setSelectedSource(source);
    setLoading(true);
    setError("");
    try {
      const page = await requestStreamPage(source, undefined, activeSearch, activeTag);
      if (version !== requestVersion.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setSources(page.sources);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError instanceof Error ? requestError.message : "스트림을 불러오지 못했습니다.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = searchInput.trim();
    if (search === activeSearch || loading) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const page = await requestStreamPage(selectedSource, undefined, search, activeTag);
      if (version !== requestVersion.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setSources(page.sources);
      setActiveSearch(search);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError instanceof Error ? requestError.message : "스트림을 불러오지 못했습니다.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  async function selectTag(tag: string) {
    if (tag === activeTag || loading) return;
    const version = ++requestVersion.current;
    setActiveTag(tag);
    setLoading(true);
    setError("");
    try {
      const page = await requestStreamPage(selectedSource, undefined, activeSearch, tag || undefined);
      if (version !== requestVersion.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setSources(page.sources);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError instanceof Error ? requestError.message : "스트림을 불러오지 못했습니다.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingRef.current) return;
      void loadPages(cursor, selectedSource, activeSearch, activeTag);
    }, { rootMargin: "600px 0px", threshold: 0.01 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeSearch, activeTag, cursor, loadPages, selectedSource]);

  return (
    <>
      <form className="stream-search" role="search" onSubmit={(event) => void submitSearch(event)}>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="미디어 스트림 검색"
          maxLength={100}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="제목 또는 출처 검색"
          type="search"
          value={searchInput}
        />
        <button type="submit" disabled={loading} aria-label="검색" title="검색"><Search size={18} /></button>
      </form>
      {activeTag && <div className="stream-active-tag"><Tag size={14} /><span>{activeTag}</span><button type="button" onClick={() => void selectTag("")} aria-label="태그 필터 해제" title="태그 필터 해제"><X size={14} /></button></div>}
      <div className="stream-filters" role="group" aria-label="출처 필터">
        {filterOptions.map(({ key, count }) => (
          <button
            className={selectedSource === key ? "active" : ""}
            key={key}
            onClick={() => void selectSource(key)}
            type="button"
          >
            <span className="filter-source-label">
              {sourceFaviconUrl(key) && <img src={sourceFaviconUrl(key)} alt="" width={13} height={13} className="source-favicon" loading="lazy" aria-hidden />}
              <strong>{sourceDisplayName(key)}</strong>
              <span>{count}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="stream-grid" ref={gridRef} aria-live="polite">
        {items.map((item) => (
          <StreamCard
            item={item}
            key={item.id}
            onFailedImage={markFailedImage}
            onSelectTag={selectTag}
            referenceTime={referenceTime}
            failedImages={failedImages}
          />
        ))}
      </div>
      <div className="stream-sentinel" ref={sentinelRef} aria-live="polite">
        {loading && <span><LoaderCircle size={17} /> 이전 트렌드를 불러오는 중</span>}
        {error && <span className="stream-error">{error}</span>}
        {!loading && !cursor && items.length > 0 && <span>저장된 트렌드를 모두 확인했습니다.</span>}
      </div>
      {items.length === 0 && !loading && <p className="stream-empty">현재 이 출처에서 불러온 콘텐츠가 없습니다.</p>}
    </>
  );
}