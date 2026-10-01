import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | 전자부품 품번 검색`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "ko_KR", siteName: site.name },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
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
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <Link href="/" aria-label={`${site.name} 홈`}>
              <Logo />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
          © {site.legalName}
        </footer>
      </body>
    </html>
  );
}
