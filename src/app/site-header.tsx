'use client';

import Link from "next/link";
import { useState } from "react";
import { Menu, MessageCircle, X } from "lucide-react";
import { LogoMark } from "./logo-mark";

export const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_dalbitmedia/chat";

const navigationLinks = [
  { href: "/#about", label: "회사 소개" },
  { href: "/#services", label: "서비스" },
  { href: "/#process", label: "진행 방식" },
  { href: "/#pricing", label: "이용 요금" },
  { href: "/stream", label: "미디어 스트림" },
  { href: "/trends", label: "키워드 트렌드" },
] as const;

type SiteHeaderProps = {
  solid?: boolean;
  compact?: boolean;
};

export function SiteHeader({ solid = false, compact = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`site-header${solid ? " site-header-solid" : ""}${compact ? " site-header-compact" : ""}`}>
      <Link className="brand" href="/" aria-label="달빛미디어 홈">
        <LogoMark />
        <span>달빛미디어</span>
      </Link>

      <nav className="desktop-nav" aria-label="주요 메뉴">
        {navigationLinks.map(({ href, label }) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>

      <div className="header-actions">
        <a className="header-contact" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">
          <MessageCircle size={17} strokeWidth={2} /> 문의하기
        </a>

        <button
          type="button"
          className="mobile-menu-button"
          aria-label={menuOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="site-header-mobile-menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
        </button>
      </div>

      {menuOpen ? (
        <div className="mobile-menu-panel" id="site-header-mobile-menu">
          <nav aria-label="모바일 주요 메뉴">
            {navigationLinks.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}