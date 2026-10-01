import type { Offer, PriceBreak } from "@/lib/providers/types";

export type QtyPrice =
  | { status: "ok"; unitPrice: number; total: number }
  /** 요청 수량이 MOQ 또는 첫 가격 구간 최소 수량보다 작음 */
  | { status: "below_min"; minQty: number }
  /** 가격 정보 없음 */
  | { status: "no_price" };

function sortedBreaks(breaks: PriceBreak[]): PriceBreak[] {
  return [...breaks].sort((a, b) => a.minQty - b.minQty);
}

/** 해당 수량에 적용되는 단가와 합계. */
export function priceAtQty(offer: Pick<Offer, "priceBreaks" | "moq">, qty: number): QtyPrice {
  const breaks = sortedBreaks(offer.priceBreaks);
  if (breaks.length === 0) return { status: "no_price" };

  const minQty = Math.max(breaks[0].minQty, offer.moq ?? 0);
  if (qty < minQty) return { status: "below_min", minQty };

  let applied = breaks[0];
  for (const b of breaks) {
    if (b.minQty <= qty) applied = b;
  }
  return { status: "ok", unitPrice: applied.unitPrice, total: roundMoney(applied.unitPrice * qty) };
}

/**
 * 정렬 기준 단가.
 * 수량이 있으면 그 수량 기준 단가, 없거나 최소 수량 미달이면 최소 구간 단가.
 * 가격이 없으면 null (정렬 시 맨 뒤).
 */
export function sortKeyPrice(offer: Pick<Offer, "priceBreaks" | "moq">, qty: number | null): number | null {
  const breaks = sortedBreaks(offer.priceBreaks);
  if (breaks.length === 0) return null;
  if (qty != null) {
    const p = priceAtQty(offer, qty);
    if (p.status === "ok") return p.unitPrice;
  }
  return breaks[0].unitPrice;
}

/**
 * 정식 유통사 결과 정렬. 가격 순 정렬 외의 가중치·숨김은 두지 않는다.
 *
 * TODO(확인필요): 통화가 섞인 경우 정렬 기준 (환율 변환 여부). 현재는 통화 코드로 먼저 묶고 그 안에서 가격 순.
 */
export function sortOffersByPrice<T extends Pick<Offer, "priceBreaks" | "moq" | "currency">>(
  offers: T[],
  qty: number | null,
): T[] {
  return offers
    .map((offer, index) => ({ offer, index, price: sortKeyPrice(offer, qty) }))
    .sort((a, b) => {
      if (a.offer.currency !== b.offer.currency) return a.offer.currency < b.offer.currency ? -1 : 1;
      if (a.price == null && b.price == null) return a.index - b.index;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      if (a.price !== b.price) return a.price - b.price;
      return a.index - b.index;
    })
    .map((x) => x.offer);
}

function roundMoney(n: number): number {
  return Math.round(n * 10000) / 10000;
}
