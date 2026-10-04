import type { Offer, ProviderResult } from "@/lib/providers/types";

/** 소싱 문의를 강조하는 이유. */
export type SourcingReason =
  /** 모든 유통사에서 검색 결과 없음 */
  | "no_results"
  /** 결과는 있으나 모든 유통사 재고 0 */
  | "all_zero_stock"
  /** 입력 수량이 최대 재고보다 많음 */
  | "qty_exceeds_stock"
  /** 단종·NRND 상태 */
  | "discontinued";

export interface SourcingSignals {
  emphasize: boolean;
  reasons: SourcingReason[];
}

const DISCONTINUED: ReadonlySet<Offer["lifecycle"]> = new Set(["nrnd", "eol", "obsolete"]);

/**
 * 소싱 문의 강조 조건 판정.
 * 이 결과는 C 영역의 강조 여부에만 쓰이며, 정식 유통사 결과(A)의 순서·표시에는 영향을 주지 않는다.
 */
export function evaluateSourcingSignals(allResults: ProviderResult[], qty: number | null): SourcingSignals {
  // 판정은 정식 유통사(authorized) 결과만으로 한다.
  const results = allResults.filter((r) => r.kind === "authorized");
  const reasons: SourcingReason[] = [];
  const offers = results.flatMap((r) => (r.status === "ok" ? r.offers : []));

  // 모든 Provider가 "결과 없음"을 확인한 경우만 해당.
  // TODO(확인필요): 일부 Provider가 조회 불가이고 나머지가 결과 없음일 때 강조할지. 현재는 강조하지 않음.
  if (results.length > 0 && results.every((r) => r.status === "no_results")) {
    reasons.push("no_results");
  }

  // 재고를 알려준 상품만 판단에 쓴다 (stock=null은 재고 미상).
  const knownStocks = offers.map((o) => o.stock).filter((s): s is number => s != null);

  if (knownStocks.length > 0 && knownStocks.every((s) => s === 0)) {
    reasons.push("all_zero_stock");
  }

  // TODO(확인필요): "최대 재고"를 유통사 한 곳의 최대 재고로 해석. 유통사 재고 합계 기준인지 확인 필요.
  if (qty != null && knownStocks.length > 0 && qty > Math.max(...knownStocks)) {
    reasons.push("qty_exceeds_stock");
  }

  if (offers.some((o) => DISCONTINUED.has(o.lifecycle))) {
    reasons.push("discontinued");
  }

  return { emphasize: reasons.length > 0, reasons };
}
