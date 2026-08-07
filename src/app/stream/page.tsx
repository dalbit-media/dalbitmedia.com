import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { getProperNounTrendData, getStoredStreamPage } from "@/lib/stream-store";
import { SiteHeader } from "../site-header";
import { LogoMark } from "../logo-mark";
import { StreamFeed } from "./stream-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tag?: string }> }): Promise<Metadata> {
  const { tag } = await searchParams;
  const initialTag = tag?.trim().slice(0, 100) ?? "";
  const title = initialTag ? `${initialTag} 관련 미디어 스트림 | 달빛미디어` : "한국 미디어 스트림 | 달빛미디어";
  const description = initialTag
    ? `${initialTag}와 관련된 최신 한국 미디어 피드와 트렌드를 실시간으로 확인하세요.`
    : "주요 소셜 플랫폼에서 주목받는 한국 미디어 콘텐츠를 한곳에서 확인하세요.";
  const canonicalPath = initialTag ? `/stream?tag=${encodeURIComponent(initialTag)}` : "/stream";

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    keywords: [initialTag || "미디어 스트림", "한국 트렌드", "소셜 미디어", "달빛미디어"],
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      locale: "ko_KR",
      siteName: "달빛미디어",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StreamPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const initialTag = tag?.trim().slice(0, 100) ?? "";
  const stream = getStoredStreamPage({ tag: initialTag || undefined, limit: 24 });
  const trendData = getProperNounTrendData();
  const renderedAt = new Date().toISOString();
  const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const updatedAt = stream.updatedAt ? dateFormatter.format(new Date(stream.updatedAt)) : "첫 수집 준비 중";

  return (
    <main className="stream-page">
      <SiteHeader solid compact />
      <section className="stream-hero">
        <div className="page-width-inner">
          <div>
            <p className="eyebrow">LIVE CULTURE SIGNAL</p>
            <h1>미디어 스트림</h1>
          </div>
          <div className="stream-summary">
            <div className="stream-status"><RefreshCw size={16} /><span>30분마다 갱신 · {updatedAt} 기준</span></div>
            <span className="source-health" tabIndex={0} aria-describedby="inactive-source-tooltip">
              활성 소스 {stream.activeSources}/{stream.totalSources}
              <span className="source-health-tooltip" id="inactive-source-tooltip" role="tooltip">
                <strong>비활성 소스</strong>
                {stream.inactiveSources.length > 0 ? stream.inactiveSources.join(" · ") : "없음"}
              </span>
            </span>
          </div>
        </div>
      </section>
      <section className="stream-content">
        <div className="section-label"><span>01</span> LATEST FEEDS</div>
        <StreamFeed initialPage={stream} initialSource="전체" initialTag={initialTag} initialTrends={trendData.windows.realtime.slice(0, 12)} renderedAt={renderedAt} />
      </section>
      <footer>
        <div className="footer-brand"><LogoMark /><div><strong>달빛미디어</strong><span>창작자를 위한 운영 파트너</span></div></div>
        <p>공개 RSS 및 공식 채널 피드를 바탕으로 제공됩니다. 콘텐츠의 권리는 각 원저작자에게 있습니다.</p>
      </footer>
    </main>
  );
}