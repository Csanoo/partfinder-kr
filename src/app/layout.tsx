import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";
import "./globals.css";

// next/font 로 자체 호스팅 (외부 요청 없음, 필요한 글리프만 분할 로드)
const plexKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-kr",
  display: "swap",
  preload: false,
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// 모든 페이지를 요청 시점에 렌더링: DB·환경변수(SITE_URL 등)를 빌드 시점에 고정하지 않기 위함
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | 전자부품 품번 검색`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "ko_KR", siteName: site.name },
  // 검색엔진 사이트 소유 확인 (SEO_SPEC 6.5). 값이 없으면 태그를 넣지 않는다
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.NAVER_SITE_VERIFICATION ? { other: { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } } : {}),
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plexKr.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: site.name,
              legalName: site.legalName,
              url: site.url,
              logo: `${site.url}/icon.svg`,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${site.url}/#website`,
              name: site.name,
              url: site.url,
              inLanguage: "ko-KR",
              publisher: { "@id": `${site.url}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search?q={search_term_string}` },
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />

        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label={`${site.name} 홈`}>
              <Logo />
            </Link>
            <nav aria-label="주 메뉴" className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200">
                부품 검색
              </Link>
              <Link href="/eol" className="rounded-md px-3 py-1.5 text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200">
                단종 부품
              </Link>
              <Link
                href="/inquiry/sourcing"
                className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                소싱 문의
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-muted">
            {/* TODO(확인필요): 운영 주체 고지 정확한 문구 (SEO 명세 제약 6) */}
            <p>
              본 사이트는 독립 운영되며, 소싱 문의는 협력 브로커를 통해 처리됩니다. 제조사·정식 유통사와 무관합니다.
            </p>
            <p>
              상호: {site.legalName} ({site.business.nameEn}) · 사업자등록번호: {site.business.registrationNo} · 주소: {site.business.address}
            </p>
            <p>
              © {site.business.since} {site.legalName}. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
