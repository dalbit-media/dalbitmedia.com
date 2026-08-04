import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { LogoMark } from "./logo-mark";

export const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_dalbitmedia/chat";

type SiteHeaderProps = {
  solid?: boolean;
  compact?: boolean;
};

export function SiteHeader({ solid = false, compact = false }: SiteHeaderProps) {
  return (
    <header className={`site-header${solid ? " site-header-solid" : ""}${compact ? " site-header-compact" : ""}`}>
      <Link className="brand" href="/" aria-label="달빛미디어 홈">
        <LogoMark />
        <span>달빛미디어</span>
      </Link>
      <nav aria-label="주요 메뉴">
        <Link href="/#about">회사 소개</Link>
        <Link href="/#services">서비스</Link>
        <Link href="/#process">진행 방식</Link>
        <Link href="/#pricing">이용 요금</Link>
        <Link href="/stream">미디어 스트림</Link>
        <Link href="/trends">키워드 트렌드</Link>
      </nav>
      <a className="header-contact" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">
        <MessageCircle size={17} strokeWidth={2} /> 문의하기
      </a>
    </header>
  );
}