import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/json-ld";
import { PackageFigure } from "@/components/package-illustration";
import { parsePackage } from "@/lib/package/parse-package";
import { SearchForm } from "@/components/search-form";
import { SearchResultSections } from "@/components/search-result-sections";
import { normalizeMpn, toSearchQuery } from "@/lib/search/normalize";
import { searchParts } from "@/lib/search/search-parts";
import { buildPartSummary } from "@/lib/seo/part-summary";
import { absoluteUrl, partPath } from "@/lib/seo/part-url";
import { site } from "@/lib/site";

const MAX_MPN_LENGTH = 64;

/** 같은 요청 안에서 generateMetadata와 페이지가 조회를 한 번만 하도록 묶는다. */
const loadPart = cache(async (mpn: string) => {
  const results = await searchParts(toSearchQuery(mpn));
  return { results, summary: buildPartSummary(mpn, results) };
});

async function resolveMpn(params: Promise<{ mpn: string }>): Promise<string> {
  const raw = decodeURIComponent((await params).mpn);
  const mpn = normalizeMpn(raw);
  if (mpn === "" || mpn.length > MAX_MPN_LENGTH) notFound();
  return mpn;
}

export async function generateMetadata(props: PageProps<"/part/[mpn]">): Promise<Metadata> {
  const mpn = await resolveMpn(props.params);
  const { summary } = await loadPart(mpn);
  const mfr = summary.manufacturers[0];
  const title = `${mpn}${mfr ? ` (${mfr})` : ""} 재고·가격`;
  const description = summary.headline.slice(0, 160);
  const url = partPath(mpn);

  return {
    title,
    description,
    alternates: { canonical: url },
    // 정식 유통사 결과가 없는 품번은 내용이 빈약하므로 색인하지 않는다 (링크는 따라감).
    robots: summary.hasAuthorizedOffers ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", url, title: `${title} | ${site.name}`, description, siteName: site.name, locale: "ko_KR" },
    twitter: { card: "summary", title: `${title} | ${site.name}`, description },
  };
}

export default async function PartPage(props: PageProps<"/part/[mpn]">) {
  const rawParam = decodeURIComponent((await props.params).mpn);
  const mpn = await resolveMpn(props.params);
  // 비정규 URL(소문자, 공백 등)은 정규 URL로 영구 이동
  if (rawParam !== mpn) permanentRedirect(partPath(mpn));

  const { results, summary } = await loadPart(mpn);
  const url = absoluteUrl(partPath(mpn));
  const pkg = parsePackage(summary.description);

  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: mpn,
    mpn,
    url,
    ...(summary.description ? { description: summary.description } : {}),
    ...(summary.manufacturers.length > 0
      ? { brand: { "@type": "Brand", name: summary.manufacturers[0] } }
      : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: mpn, item: url },
    ],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: summary.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <article className="space-y-6">
      <JsonLd data={[productLd, breadcrumbLd, faqLd]} />

      <nav aria-label="경로" className="text-sm text-zinc-500">
        <Link href="/" className="hover:underline">
          {site.name}
        </Link>{" "}
        / <span>{mpn}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <PackageFigure info={pkg} size={112} />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            <span className="font-mono">{mpn}</span> 재고·가격
          </h1>
          {/* 답변 엔진이 인용하기 쉬운 첫 문단: 결론 먼저 */}
          <p className="text-zinc-700 dark:text-zinc-300">{summary.headline}</p>
          {pkg.family !== "unknown" && (
            <p className="text-xs text-zinc-500">패키지 그림은 형태를 나타낸 일러스트이며 실제 제품 사진이 아닙니다.</p>
          )}
        </div>
      </header>

      <SearchForm defaultQuery={mpn} />

      <SearchResultSections results={results} mpn={mpn} qty={null} />

      <section aria-labelledby="faq-heading" className="space-y-3">
        <h2 id="faq-heading" className="text-lg font-semibold">
          자주 묻는 질문
        </h2>
        <dl className="space-y-3">
          {summary.faq.map((f) => (
            <div key={f.question}>
              <dt className="font-medium">{f.question}</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
