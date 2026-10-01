import type { Metadata } from "next";
import { headers } from "next/headers";
import { prismaSearchLogRepo } from "@/lib/repos";
import { logSearch } from "@/lib/search/search-log";
import { SESSION_HEADER } from "@/proxy";
import { SearchForm } from "@/components/search-form";
import { SearchResultSections } from "@/components/search-result-sections";
import { parseQty, toSearchQuery } from "@/lib/search/normalize";
import { searchParts } from "@/lib/search/search-parts";

// 검색 결과 페이지는 항상 색인하지 않는다 (SEO 명세 제약 2).
export const metadata: Metadata = {
  title: "검색 결과",
  robots: { index: false, follow: true },
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SearchPage(props: PageProps<"/search">) {
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
      <SearchForm defaultQuery={rawQuery} defaultQty={qty == null ? "" : String(qty)} />

      {results == null ? (
        <p className="text-zinc-600 dark:text-zinc-400">품번을 입력해 주세요.</p>
      ) : (
        <SearchResultSections results={results} mpn={rawQuery.trim()} qty={qty} searchLogId={searchLogId} />
      )}
    </div>
  );
}
