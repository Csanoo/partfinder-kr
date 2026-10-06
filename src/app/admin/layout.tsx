import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
// 본문 글꼴: Pretendard (한국어·영문), Pretendard JP (일본어). 패키지에서 자체 호스팅, 화면에 쓰인 글자 묶음만 내려받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css";
import Link from "next/link";
import { Logo } from "@/components/logo";
import "../globals.css";

// 관리자 화면은 공개 페이지(app/[lang])와 별도의 루트 레이아웃을 쓴다 (한국어 전용)
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

const nav = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/inquiries", label: "문의" },
  { href: "/admin/seo", label: "SEO 지표" },
  { href: "/admin/parts", label: "부품" },
  { href: "/admin/parts/new", label: "부품 등록" },
  { href: "/admin/parts/import", label: "CSV 가져오기" },
  { href: "/admin/facts", label: "제조사 정보 검토" },
  { href: "/admin/taxonomy", label: "제조사·카테고리" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ko" className={`${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link href="/" aria-label="사이트로 이동">
              <Logo />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1 border-b border-line pb-3">
        <span className="mr-2 rounded bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">ADMIN</span>
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40"
          >
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
        </main>
      </body>
    </html>
  );
}
