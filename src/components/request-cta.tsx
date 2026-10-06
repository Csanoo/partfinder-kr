import Link from "next/link";
import { formatFetchedAt, formatInt } from "@/lib/format";
import type { ProviderResult } from "@/lib/providers/types";
import type { SourcingReason, SourcingSignals } from "@/lib/search/sourcing";

export const SOURCING_DISCLAIMER =
  "소싱 부품은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.";

const reasonLabel: Record<SourcingReason, string> = {
  no_results: "정식 유통사 검색 결과가 없습니다.",
  all_zero_stock: "정식 유통사 재고가 모두 0입니다.",
  qty_exceeds_stock: "입력 수량이 정식 유통사 최대 재고보다 많습니다.",
  discontinued: "단종 또는 신규 설계 비권장(NRND) 부품입니다.",
};

export function requestHref(mpn: string, qty: number | null, searchLogId: string | null = null): string {
  const params = new URLSearchParams({ mpn });
  if (qty != null) params.set("qty", String(qty));
  if (searchLogId) params.set("sl", searchLogId);
  return `/request?${params.toString()}`;
}

/**
 * 검색 결과 맨 위: 이 부품 요청하기. 정식 유통 재고가 부족하면(강조 조건) 이유를 함께 보여준다.
 * 강조 여부는 문구에만 영향을 주고, 아래 참고용 재고 표의 순서·내용은 바꾸지 않는다.
 */
export function RequestCta({
  mpn,
  qty,
  signals,
  searchLogId = null,
}: {
  mpn: string;
  qty: number | null;
  signals: SourcingSignals;
  searchLogId?: string | null;
}) {
  return (
    <section
      aria-labelledby="request-cta-heading"
      data-emphasized={signals.emphasize}
      className="flex flex-col gap-4 rounded-md border border-brand-600 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-400"
    >
      <div className="space-y-1">
        <h2 id="request-cta-heading" className="text-lg font-bold">
          {signals.emphasize ? "정식 유통 재고로는 부족합니다. 찾아서 공급해 드릴까요?" : "이 부품, 찾아서 공급해 드립니다"}
        </h2>
        {signals.emphasize ? (
          <ul className="list-disc pl-5 text-sm text-copper-700 dark:text-copper-200">
            {signals.reasons.map((r) => (
              <li key={r}>{reasonLabel[r]}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">수량·납기를 알려주시면 가격과 납기를 확인해 회신드립니다.</p>
        )}
        <p className="text-xs text-muted">단종·품귀 부품은 공급처를 찾아 출처와 조건을 함께 안내드립니다. {SOURCING_DISCLAIMER}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
        <Link
          href={requestHref(mpn, qty, searchLogId)}
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          이 부품 요청하기
        </Link>
        <Link href="/request" className="text-xs text-brand-600 hover:underline dark:text-brand-300">
          여러 품목은 BOM으로 한 번에 요청 →
        </Link>
      </div>
    </section>
  );
}

/**
 * 시장 재고 참고 (broker 소스). 출처(소스명·조회 시각·링크)를 함께 표시한다.
 * 가격은 표시하지 않는다. TODO(확인필요): 소싱 소스 가격 표시 여부
 */
export function BrokerListings({ results }: { results: ProviderResult[] }) {
  const offers = results.flatMap((r) => (r.status === "ok" ? r.offers : []));
  if (offers.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface p-4" data-testid="broker-listings">
      <h3 id="broker-listings-heading" className="mb-1 text-sm font-semibold">
        시장 재고 참고
      </h3>
      <p className="mb-2 text-xs text-muted">외부 시장에 게시된 재고 정보로, 실제 재고·정품 여부는 확인되지 않았습니다.</p>
      <ul className="space-y-1 text-sm">
        {offers.map((o) => (
          <li key={`${o.providerId}:${o.productUrl}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{o.providerName}</span>
            <span className="mpn text-xs">{o.mpn}</span>
            <span>{o.stock == null ? "수량 미기재" : `${formatInt(o.stock)}개 게시`}</span>
            <span className="text-xs text-muted">({formatFetchedAt(o.fetchedAt)})</span>
            <a href={o.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-brand-600 hover:underline dark:text-brand-300">
              출처 ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
