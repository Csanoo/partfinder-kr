import type { Metadata } from "next";
import { headers } from "next/headers";
import { prismaSearchLogRepo } from "@/lib/repos";
import { logSearch } from "@/lib/search/search-log";
import { SESSION_HEADER } from "@/proxy";
import { SearchForm } from "@/components/search-form";
import { SearchResultSections } from "@/components/search-result-sections";
import { parseQty, toSearchQuery } from "@/lib/search/normalize";
import { searchParts } from "@/lib/search/search-parts";
import { hasLocale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";

// 검색 결과 페이지는 항상 색인하지 않는다 (SEO 명세 제약 2).
export async function generateMetadata(props: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await props.params;
  return { title: getDictionary(hasLocale(lang) ? lang : undefined).search.metaTitle, robots: { index: false, follow: true } };
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SearchPage(props: PageProps<"/[lang]/search">) {
  const { lang } = await props.params;
  const locale = hasLocale(lang) ? lang : "ko";
  const t = getDictionary(locale).search;
  const params = await props.searchParams;
  const rawQuery = first(params.q);
  const rawQty = first(params.qty);
  const query = toSearchQuery(rawQuery);
  const qty = parseQty(rawQty);

  const results = query.normalized === "" ? null : await searchParts(query);

  let searchLogId: string | null = null;
  if (results != null) {
    const h = await headers();
    searchLogId = await logSearch(prismaSearchLogRepo, {
      query,
      qty,
      results,
      sessionId: h.get(SESSION_HEADER),
      userAgent: h.get("user-agent"),
      source: "search",
    });
  }

  return (
    <div className="space-y-6">
      <SearchForm defaultQuery={rawQuery} defaultQty={qty == null ? "" : String(qty)} locale={locale} />

      {results == null ? (
        <p className="text-muted">{t.enterMpn}</p>
      ) : (
        <>
          <h1 className="text-xl font-bold">
            <span className="mpn">{query.normalized}</span>
            <span className="ml-2 text-base font-normal text-muted">
              {t.results}
              {qty != null && ` · ${fmt(t.needQty, { n: qty.toLocaleString(locale) })}`}
            </span>
          </h1>
          <SearchResultSections results={results} mpn={rawQuery.trim()} qty={qty} searchLogId={searchLogId} locale={locale} />
        </>
      )}
    </div>
  );
}
