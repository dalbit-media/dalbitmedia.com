import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarDays, Clock3, Database, Radio, CalendarRange } from "lucide-react";

import { getProperNounTrendData, type ProperNounTrend } from "@/lib/stream-store";
import { SiteHeader } from "../site-header";

export function generateMetadata(): Metadata {
  return {
    title: "한국 미디어 트렌드 랭킹 100 | 달빛미디어",
    description: "한국 미디어 피드에서 관측된 상위 100개 키워드와 실시간·주간·월간 트렌드를 확인하세요.",
    alternates: { canonical: "/trends" },
    keywords: ["한국 미디어 트렌드", "트렌드 랭킹", "키워드 트렌드", "고유명사 트렌드", "달빛미디어"],
    openGraph: {
      title: "한국 미디어 트렌드 랭킹 100 | 달빛미디어",
      description: "한국 미디어 피드에서 관측된 상위 100개 키워드와 실시간·주간·월간 트렌드를 확인하세요.",
      url: "/trends",
      type: "website",
      locale: "ko_KR",
      siteName: "달빛미디어",
    },
    twitter: {
      card: "summary_large_image",
      title: "한국 미디어 트렌드 랭킹 100 | 달빛미디어",
      description: "한국 미디어 피드에서 관측된 상위 100개 키워드와 실시간·주간·월간 트렌드를 확인하세요.",
    },
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const windows = [
  ["realtime", "실시간", "최근 6시간", Radio],
  ["day", "24시간", "최근 하루", Clock3],
  ["week", "7일", "최근 일주일", CalendarDays],
  ["month", "30일", "최근 한 달", Database],
  ["quarter", "3개월", "최근 3개월", CalendarRange],
  ["half", "6개월", "최근 6개월", CalendarRange],
] as const;

function TrendList({ trends, title, subtitle }: { trends: ProperNounTrend[]; title: string; subtitle: string }) {
  if (trends.length === 0) return <p className="trend-empty">아직 이 구간에 관측된 키워드가 없습니다.</p>;
  const visibleTrends = trends.slice(0, 20);
  const maximum = visibleTrends[0]?.count ?? 1;
  const rankingUrl = `/trends/full?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}`;
  return <>
    <ol className="trend-ranking">
      {visibleTrends.map((trend, index) => <li key={trend.normalized}>
        <span className="trend-rank">{String(index + 1).padStart(2, "0")}</span>
        <div className="trend-name">
          <Link href={`/stream?tag=${encodeURIComponent(trend.normalized)}`}>{trend.displayName}</Link>
          <span className="trend-bar"><i style={{ width: `${Math.max(8, trend.count / maximum * 100)}%` }} /></span>
        </div>
        <span className="trend-count"><strong>{trend.count}</strong>건 · {trend.sourceCount}개 소스</span>
      </li>)}
    </ol>
    {trends.length > visibleTrends.length && (
      <div className="trend-card-footer">
        <Link href={rankingUrl} className="button button-coral trend-see-full">전체 랭킹 보기</Link>
      </div>
    )}
  </>;
}

export default function TrendsPage() {
  const data = getProperNounTrendData();
  const formatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const monthFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long" });

  return <main className="trends-page">
    <SiteHeader solid compact />
    <section className="trends-heading">
      <div className="page-width-inner">
        <div>
          <p className="eyebrow">KOREAN ENTITY SIGNAL</p>
          <h1>키워드 트렌드</h1>
        </div>
        <div className="trends-tracking"><Activity size={17} /><span>{formatter.format(new Date(data.trackedSince))}부터 추적</span></div>
      </div>
    </section>

    <section className="trends-content">
      <div className="trend-window-grid">
        {windows.map(([key, title, subtitle, Icon]) => {
          const totalForWindow = data.windows[key].reduce((sum, trend) => sum + trend.count, 0);
          return <article className="trend-window" key={key}>
            <header>
              <div>
                <span>{subtitle}</span>
                <h2>{title}</h2>
              </div>
              <div className="trend-window-meta">
                <strong>{totalForWindow.toLocaleString("ko-KR")}건</strong>
                <Icon size={20} />
              </div>
            </header>
            <TrendList trends={data.windows[key]} title={title} subtitle={subtitle} />
          </article>;
        })}
      </div>

      <section className="trend-history">
        <header>
          <div><span>TRACKED HISTORY</span><h2>지난 1년 월별 키워드</h2></div>
          <p>관측을 시작한 이후의 데이터만 표시합니다.</p>
        </header>
        {data.history.length > 0 ? <div className="trend-timeline">
          {data.history.map((period) => <article key={period.month}>
            <time>{monthFormatter.format(new Date(`${period.month}-01T00:00:00Z`))}</time>
            <div>{period.keywords.map((keyword, index) => <Link key={keyword.normalized} href={`/stream?tag=${encodeURIComponent(keyword.normalized)}`} style={{ fontSize: `${Math.max(12, 21 - index * 1.1)}px` }}><strong>{keyword.displayName}</strong><span>{keyword.count}</span></Link>)}</div>
          </article>)}
        </div> : <p className="trend-history-empty">첫 관측 데이터가 쌓이는 중입니다.</p>}
      </section>
    </section>
  </main>;
}