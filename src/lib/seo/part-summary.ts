import { formatFetchedAt, formatInt, formatMoney, lifecycleLabel } from "@/lib/format";
import type { Offer, ProviderResult } from "@/lib/providers/types";
import { sortKeyPrice, sortOffersByPrice } from "@/lib/search/pricing";
import { site } from "@/lib/site";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PartSummary {
  mpn: string;
  /** 정식 유통사 결과에서 확인된 제조사 (중복 제거) */
  manufacturers: string[];
  description: string | null;
  /** 재고 > 0 인 정식 유통사 수 */
  inStockSourceCount: number;
  /** 정식 유통사 상품이 하나라도 있는지 (색인 여부 판단) */
  hasAuthorizedOffers: boolean;
  /** 답변 엔진이 그대로 인용할 수 있는 한 문단 요약 */
  headline: string;
  faq: FaqItem[];
  /** 기준 시각 (가장 최근 조회) */
  asOf: string | null;
}

const DISCONTINUED = new Set<Offer["lifecycle"]>(["nrnd", "eol", "obsolete"]);

/**
 * 품번 페이지의 요약·FAQ 생성 (AEO).
 * 모든 수치는 정식 유통사(authorized) 결과에서만 만들고, 출처(유통사명)와 조회 시각을 문장에 포함한다.
 */
export function buildPartSummary(mpn: string, results: ProviderResult[]): PartSummary {
  const authorized = results.filter((r) => r.kind === "authorized");
  const offers = authorized.flatMap((r) => (r.status === "ok" ? r.offers : []));
  const asOf = latest(authorized.map((r) => r.fetchedAt));
  const asOfText = asOf ? `${formatFetchedAt(asOf)} 기준` : "";

  const manufacturers = unique(offers.map((o) => o.manufacturer).filter(Boolean));
  const description = offers.find((o) => o.description)?.description ?? null;
  const inStock = offers.filter((o) => (o.stock ?? 0) > 0);
  const inStockSources = unique(inStock.map((o) => o.providerName));

  const faq: FaqItem[] = [];

  // 재고
  let stockAnswer: string;
  if (offers.length === 0) {
    stockAnswer = `${asOfText} 조회한 정식 유통사에서 ${mpn} 검색 결과가 없습니다. 브로커 소싱 문의를 남기시면 다른 경로로 확인해 드립니다.`;
  } else if (inStock.length === 0) {
    stockAnswer = `${asOfText} 정식 유통사 ${unique(offers.map((o) => o.providerName)).length}곳 모두 ${mpn} 재고가 0개입니다. 견적 또는 브로커 소싱 문의를 남기실 수 있습니다.`;
  } else {
    const parts = inStock.map((o) => `${o.providerName} ${formatInt(o.stock ?? 0)}개`).join(", ");
    stockAnswer = `${asOfText} 정식 유통사 ${inStockSources.length}곳에서 재고를 확인했습니다: ${parts}.`;
  }
  faq.push({ question: `${mpn} 재고가 있나요?`, answer: stockAnswer.trim() });

  // 가격 (1개 기준 최저 단가, 통화별로 섞지 않고 정렬 첫 통화 기준)
  const priced = sortOffersByPrice(
    offers.filter((o) => o.priceBreaks.length > 0),
    null,
  );
  if (priced.length > 0) {
    const best = priced[0];
    const price = sortKeyPrice(best, null)!;
    faq.push({
      question: `${mpn} 가격은 얼마인가요?`,
      answer: `${asOfText} 정식 유통사 최소 주문 구간 단가 중 가장 낮은 값은 ${best.providerName}의 ${formatMoney(price, best.currency)}입니다. 수량이 많을수록 단가가 낮아지며, 가격은 유통사 사정에 따라 바뀔 수 있습니다.`.trim(),
    });
  }

  // 단종 여부
  const lifecycles = offers.map((o) => o.lifecycle).filter((l) => l !== "unknown");
  if (lifecycles.length > 0) {
    const flagged = offers.filter((o) => DISCONTINUED.has(o.lifecycle));
    faq.push({
      question: `${mpn} 단종 여부는?`,
      answer:
        flagged.length > 0
          ? `정식 유통사 표기 기준 ${unique(flagged.map((o) => `${o.providerName}: ${lifecycleLabel[o.lifecycle]}`)).join(", ")} 상태입니다. 장기 수급이 필요하면 소싱 문의를 권합니다.`
          : `정식 유통사 표기 기준 양산(Active) 상태입니다.`,
    });
  }

  faq.push({
    question: `${mpn} 견적은 어떻게 받나요?`,
    answer: `${site.name}에서 견적 문의 양식에 수량과 희망 납기를 남기시면 담당자가 확인 후 연락드립니다. 정식 유통사에서 구하기 어려운 경우 브로커 소싱 문의도 가능합니다.`,
  });

  const mfr = manufacturers.length > 0 ? `${manufacturers.join(", ")}의 ` : "";
  const desc = description ? ` (${description})` : "";
  const headline = `${mfr}${mpn}${desc}. ${stockAnswer}`.trim();

  return {
    mpn,
    manufacturers,
    description,
    inStockSourceCount: inStockSources.length,
    hasAuthorizedOffers: offers.length > 0,
    headline,
    faq,
    asOf,
  };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function latest(isoList: string[]): string | null {
  return isoList.length === 0 ? null : isoList.reduce((a, b) => (a > b ? a : b));
}
