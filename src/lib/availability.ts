import { getEnabledProviders } from "@/lib/providers/registry";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import type { PartProvider, ProviderResult } from "@/lib/providers/types";
import { toSearchQuery } from "@/lib/search/normalize";
import { isBot } from "@/lib/search/search-log";
import { searchParts, type SearchOptions } from "@/lib/search/search-parts";

/**
 * 부품 페이지 정식 유통사 재고 (docs/SEO_SPEC.md 6.4).
 * 재고 있음/없음 + 유통사명 + 조회 시각 + 유통사 링크만. 가격·정확한 수량은 내보내지 않는다.
 */

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown" | "no_results" | "unavailable";

export interface AvailabilityRow {
  providerName: string;
  status: AvailabilityStatus;
  /** 유통사 상품 페이지 (결과 없음·조회 불가면 null) */
  url: string | null;
  fetchedAt: string;
}

export type AvailabilityResponse =
  | { kind: "ok"; mpn: string; rows: AvailabilityRow[] }
  /** 검색엔진 봇: 유통사를 호출하지 않는다 */
  | { kind: "bot" }
  | { kind: "invalid" }
  | { kind: "rate_limited" };

/** Provider 결과 → 화면 행. 정식 유통사(authorized)만 */
export function summarizeAvailability(results: ProviderResult[]): AvailabilityRow[] {
  return results
    .filter((r) => r.kind === "authorized")
    .map((r): AvailabilityRow => {
      if (r.status === "no_results") return { providerName: r.providerName, status: "no_results", url: null, fetchedAt: r.fetchedAt };
      if (r.status === "unavailable") return { providerName: r.providerName, status: "unavailable", url: null, fetchedAt: r.fetchedAt };
      const inStock = r.offers.find((o) => (o.stock ?? 0) > 0);
      const known = r.offers.some((o) => o.stock != null);
      return {
        providerName: r.providerName,
        status: inStock ? "in_stock" : known ? "out_of_stock" : "unknown",
        url: (inStock ?? r.offers[0]).productUrl,
        fetchedAt: r.fetchedAt,
      };
    })
    .sort((a, b) => a.providerName.localeCompare(b.providerName, "ko"));
}

/** IP 기준 남용 방지 (유통사 일일 쿼터 보호). TODO(확인필요): 한도 값 */
export const AVAILABILITY_IP_POLICY = { perMinute: 30, perDay: 500 };
const g = globalThis as unknown as { __availLimiter?: ProviderRateLimiter };
const defaultLimiter = (g.__availLimiter ??= new ProviderRateLimiter());

export async function getAvailability(
  mpnRaw: string | null,
  userAgent: string | null,
  ip: string,
  deps: { limiter?: ProviderRateLimiter; providers?: PartProvider[]; search?: SearchOptions } = {},
): Promise<AvailabilityResponse> {
  if (isBot(userAgent)) return { kind: "bot" };
  const mpn = (mpnRaw ?? "").trim();
  if (mpn === "" || mpn.length > 64) return { kind: "invalid" };
  if (!(deps.limiter ?? defaultLimiter).tryAcquire(`avail:${ip}`, AVAILABILITY_IP_POLICY).ok) return { kind: "rate_limited" };

  // 정식 유통사 Provider만 호출 (브로커 소스는 부품 페이지에서 쓰지 않음)
  const providers = (deps.providers ?? getEnabledProviders()).filter((p) => p.kind === "authorized");
  const results = await searchParts(toSearchQuery(mpn), { ...deps.search, providers });
  return { kind: "ok", mpn, rows: summarizeAvailability(results) };
}
