import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
// 본문 글꼴: Pretendard (한국어·영문), Pretendard JP (일본어). 패키지에서 자체 호스팅, 화면에 쓰인 글자 묶음만 내려받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { JsonLd } from "@/components/json-ld";
import { Logo } from "@/components/logo";
import { hasLocale, LOCALE_TAG, localePath } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { site, siteName } from "@/lib/site";
import "../globals.css";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// 모든 페이지를 요청 시점에 렌더링: DB·환경변수(SITE_URL 등)를 빌드 시점에 고정하지 않기 위함
export const dynamic = "force-dynamic";

export async function generateMetadata(props: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(site.url),
    title: { default: fmt(t.meta.titleDefault, { site: siteName(lang) }), template: `%s | ${siteName(lang)}` },
    description: t.meta.description,
    applicationName: siteName(lang),
    openGraph: { type: "website", locale: LOCALE_TAG[lang].replace("-", "_"), siteName: siteName(lang) },
    // 검색엔진 사이트 소유 확인 (SEO_SPEC 6.5). 값이 없으면 태그를 넣지 않는다
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
      ...(process.env.NAVER_SITE_VERIFICATION ? { other: { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } } : {}),
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const lp = (p: string) => localePath(lang, p);
  return (
    <html lang={lang} className={`${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: siteName(lang),
              legalName: site.legalName,
              url: site.url,
              logo: `${site.url}/icon.svg`,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${site.url}/#website`,
              name: siteName(lang),
              url: site.url,
              inLanguage: LOCALE_TAG[lang],
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
            <Link href={lp("/")} aria-label={fmt(t.common.homeAria, { site: siteName(lang) })}>
              <Logo locale={lang} />
            </Link>
            <nav aria-label={t.common.mainMenu} className="flex items-center gap-1 text-sm">
              <Link href={lp("/search")} className="hidden sm:inline-block rounded-md px-3 py-1.5 text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200">
                {t.common.navStock}
              </Link>
              <Link href={lp("/eol")} className="hidden sm:inline-block rounded-md px-3 py-1.5 text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200">
                {t.common.navEol}
              </Link>
              <Link
                href={lp("/request")}
                className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                {t.common.navRequest}
              </Link>
              <LanguageSwitcher locale={lang} label={t.common.language} />
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-muted">
            {/* 운영 주체 고지 (SEO 명세 제약 6): 모든 페이지 공통 푸터에 한 번만 표시 */}
            <p>{t.common.operatorNotice}</p>
            <p>{fmt(t.common.footerCompany, { legal: site.legalName, legalEn: site.business.nameEn, regNo: site.business.registrationNo })}</p>
            <p>{fmt(t.common.footerRights, { year: site.business.since, legal: site.legalName, legalEn: site.business.nameEn })}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
