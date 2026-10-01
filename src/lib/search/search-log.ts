import type { ProviderResult, SearchQuery } from "@/lib/providers/types";

export type SearchSource = "search" | "part";

export interface SearchLogRecord {
  queryRaw: string;
  queryNormalized: string;
  qty: number | null;
  /** providerId → 결과 수 (조회 불가면 null) */
  resultCountByProvider: Record<string, number | null>;
  hasAnyStock: boolean;
  sessionId: string | null;
  source: SearchSource;
}

export interface SearchLogRepo {
  create(record: SearchLogRecord): Promise<{ id: string }>;
}

/** 검색 엔진·미리보기 봇은 수요 지표를 오염시키므로 기록하지 않는다. */
const BOT_UA = /bot|crawl|spider|slurp|yeti|daumoa|preview|headless|lighthouse|facebookexternalhit|curl|wget|python|httpclient/i;

export function isBot(userAgent: string | null): boolean {
  return userAgent == null || userAgent.trim() === "" || BOT_UA.test(userAgent);
}

export function toSearchLogRecord(
  query: SearchQuery,
  qty: number | null,
  results: ProviderResult[],
  sessionId: string | null,
  source: SearchSource,
): SearchLogRecord {
  const resultCountByProvider: Record<string, number | null> = {};
  for (const r of results) {
    resultCountByProvider[r.providerId] = r.status === "ok" ? r.offers.length : r.status === "no_results" ? 0 : null;
  }
  // 재고 유무는 정식 유통사 기준
  const hasAnyStock = results.some(
    (r) => r.kind === "authorized" && r.status === "ok" && r.offers.some((o) => (o.stock ?? 0) > 0),
  );
  return {
    queryRaw: query.raw,
    queryNormalized: query.normalized,
    qty,
    resultCountByProvider,
    hasAnyStock,
    sessionId,
    source,
  };
}

/**
 * 검색 로그 저장. 실패해도 검색 화면은 정상 동작해야 하므로 예외를 삼키고 null을 돌려준다.
 */
export async function logSearch(
  repo: SearchLogRepo,
  args: {
    query: SearchQuery;
    qty: number | null;
    results: ProviderResult[];
    sessionId: string | null;
    userAgent: string | null;
    source: SearchSource;
  },
): Promise<string | null> {
  if (args.query.normalized === "" || isBot(args.userAgent)) return null;
  try {
    const { id } = await repo.create(toSearchLogRecord(args.query, args.qty, args.results, args.sessionId, args.source));
    return id;
  } catch (err) {
    console.error("[search-log] failed to save:", err);
    return null;
  }
}
