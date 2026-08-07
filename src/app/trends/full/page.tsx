import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft, CalendarDays, CalendarRange, Clock3, Database, Radio } from "lucide-react";

import { SiteHeader } from "../../site-header";
import { getProperNounTrendData, type ProperNounTrend } from "@/lib/stream-store";

const windows = [
  ["realtime", "실시간", "최근 6시간", Radio],
  ["day", "24시간", "최근 하루", Clock3],
  ["week", "7일", "최근 일주일", CalendarDays],
  ["month", "30일", "최근 한 달", Database],
  ["quarter", "3개월", "최근 3개월", CalendarRange],
  ["half", "6개월", "최근 6개월", CalendarRange],
] as const;

const sidebarOrder = ["half", "quarter", "month", "week", "day", "realtime"] as const;

function resolveWindow(title?: string | string[], subtitle?: string | string[]) {
  const decodedTitle = typeof title === "string" ? title : undefined;
  const decodedSubtitle = typeof subtitle === "string" ? subtitle : undefined;
  return windows.find(([key, windowTitle, windowSubtitle]) => {
    if (decodedTitle && windowTitle === decodedTitle) return true;
    if (decodedSubtitle && windowSubtitle === decodedSubtitle) return true;
    if (decodedTitle && decodedSubtitle && windowTitle === decodedTitle && windowSubtitle === decodedSubtitle) return true;
    return key === "realtime" && !decodedTitle && !decodedSubtitle;
  }) ?? windows[0];
}

function FullRankingList({ trends }: { trends: ProperNounTrend[] }) {
  if (trends.length === 0) return <p className="trend-empty">아직 이 구간에 관측된 키워드가 없습니다.</p>;
  const maximum = trends[0]?.count ?? 1;

  return <ol className="trend-ranking full-ranking-list">
    {trends.map((trend, index) => <li key={trend.normalized}>
      <span className="trend-rank">{String(index + 1).padStart(2, "0")}</span>
      <div className="trend-name">
        <Link href={`/stream?tag=${encodeURIComponent(trend.normalized)}`}>{trend.displayName}</Link>
        <span className="trend-bar"><i style={{ width: `${Math.max(8, trend.count / maximum * 100)}%` }} /></span>
      </div>
      <span className="trend-count"><strong>{trend.count}</strong>건 · {trend.sourceCount}개 소스</span>
    </li>)}
  </ol>;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ title?: string | string[]; subtitle?: string | string[] }> }): Promise<Metadata> {
  const { title, subtitle } = await searchParams;
  const window = resolveWindow(title, subtitle);
  const windowTitle = window[1];
  const heading = `${windowTitle} 키워드 랭킹 100`;
  return {
    title: `${heading} | 달빛미디어`,
    description: `${windowTitle} 기간에 관측된 상위 100개 키워드를 확인하세요.`,
    alternates: { canonical: `/trends/full` },
    openGraph: {
      title: `${heading} | 달빛미디어`,
      description: `${windowTitle} 기간에 관측된 상위 100개 키워드를 확인하세요.`,
      url: "/trends/full",
      type: "website",
      locale: "ko_KR",
      siteName: "달빛미디어",
    },
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FullRankingPage({ searchParams }: { searchParams: Promise<{ title?: string | string[]; subtitle?: string | string[] }> }) {
  const { title, subtitle } = await searchParams;
  const data = getProperNounTrendData();
  const selectedWindow = resolveWindow(title, subtitle);
  const [key, windowTitle, windowSubtitle, Icon] = selectedWindow;
  const selectedTrends = data.windows[key];
  const formatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return <main className="trends-page full-ranking-page">
    <SiteHeader solid compact />
    <section className="trends-heading">
      <div className="page-width-inner full-ranking-heading">
        <div>
          <p className="eyebrow">KOREAN ENTITY SIGNAL</p>
          <h1>{windowTitle} 전체 랭킹</h1>
          <p className="full-ranking-subtitle">{windowSubtitle} 기준의 상위 100개 키워드입니다.</p>
        </div>
        <div className="trends-tracking"><Activity size={17} /><span>{formatter.format(new Date(data.trackedSince))}부터 추적</span></div>
      </div>
    </section>

    <section className="trends-content">
      <div className="full-ranking-shell">
        <section className="full-ranking-main">
          <header className="full-ranking-main-header">
            <div>
              <span className="eyebrow eyebrow-inline">FULL RANKING</span>
              <h2>{windowTitle} 랭킹</h2>
              <p>{windowSubtitle} 동안 관측된 키워드를 전체 순위로 정리했습니다.</p>
            </div>
            <Link href="/trends" className="button button-coral full-ranking-back">
              <ArrowLeft size={16} /> 트렌드 목록으로
            </Link>
          </header>
          <FullRankingList trends={selectedTrends} />
        </section>

        <aside className="full-ranking-sidebar">
          <div className="full-ranking-sidebar-header">
            <h2>다른 기간</h2>
            <p>긴 기간부터 짧은 기간 순</p>
          </div>
          <div className="full-ranking-sidebar-list">
            {sidebarOrder.filter((windowKey) => windowKey !== key).map((windowKey) => {
              const [sidebarKey, sidebarTitle, sidebarSubtitle, SidebarIcon] = windows.find(([entryKey]) => entryKey === windowKey) ?? windows[0];
              const sidebarTrends = data.windows[sidebarKey];
              const isActive = sidebarKey === key;
              return <Link key={sidebarKey} href={`/trends/full?title=${encodeURIComponent(sidebarTitle)}&subtitle=${encodeURIComponent(sidebarSubtitle)}`} className={`full-ranking-sidebar-card${isActive ? " is-active" : ""}`}>
                <div className="full-ranking-sidebar-card-head">
                  <div>
                    <span>{sidebarSubtitle}</span>
                    <h3>{sidebarTitle}</h3>
                  </div>
                  <SidebarIcon size={16} />
                </div>
                <ul>
                  {sidebarTrends.slice(0, 4).map((trend) => <li key={trend.normalized}>{trend.displayName}</li>)}
                </ul>
              </Link>;
            })}
          </div>
        </aside>
      </div>
    </section>
  </main>;
}
