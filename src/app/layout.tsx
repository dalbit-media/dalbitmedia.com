import type { Metadata } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ScrollToTop } from "./scroll-to-top";

const notoSans = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
});

const gowunBatang = Gowun_Batang({
  variable: "--font-serif",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "달빛미디어 | 창작자를 위한 운영 파트너",
  description: "테스트, 배포, 마케팅, 리뷰 관리와 고객 지원까지. 달빛미디어가 운영의 전 과정을 함께합니다.",
  keywords: ["미디어 배포", "콘텐츠 마케팅", "고객관리", "리뷰 관리", "달빛미디어"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSans.variable} ${gowunBatang.variable}`}>
      <body>
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}
