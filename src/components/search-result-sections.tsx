import { DistributorResults } from "@/components/distributor-results";
import { BrokerListings, RequestCta } from "@/components/request-cta";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import type { ProviderResult } from "@/lib/providers/types";
import { evaluateSourcingSignals } from "@/lib/search/sourcing";

/**
 * 결과 화면: 부품 요청(맨 위) → 참고용 재고 현황(접힘: 정식 유통사 → 시장 재고).
 * 서비스의 중심은 "필요한 부품을 찾아 공급"이고, 유통사 재고는 판단을 돕는 참고 정보로만 둔다.
 */
export function SearchResultSections({
  results,
  mpn,
  qty,
  searchLogId = null,
  locale = DEFAULT_LOCALE,
}: {
  results: ProviderResult[];
  mpn: string;
  qty: number | null;
  searchLogId?: string | null;
  locale?: Locale;
}) {
  const t = getDictionary(locale).cta;
  const signals = evaluateSourcingSignals(results, qty);
  const authorized = results.filter((r) => r.kind === "authorized");
  const withStock = authorized.filter((r) => r.status === "ok" && r.offers.some((o) => (o.stock ?? 0) > 0)).length;
  return (
    <div className="space-y-4">
      <RequestCta mpn={mpn} qty={qty} signals={signals} searchLogId={searchLogId} locale={locale} />
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold">
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden="true">
            ▸
          </span>
          {t.stockRef}
          <span className="font-normal text-muted">{fmt(t.stockRefCount, { total: authorized.length, n: withStock })}</span>
        </summary>
        <div className="mt-2 space-y-4">
          <DistributorResults results={results} qty={qty} locale={locale} />
          <BrokerListings results={results.filter((r) => r.kind === "broker")} locale={locale} />
        </div>
      </details>
    </div>
  );
}
