import { describe, expect, it } from "vitest";
import type { Offer, ProviderResult } from "@/lib/providers/types";
import { buildPartSummary } from "@/lib/seo/part-summary";
import { partPath } from "@/lib/seo/part-url";

const fetchedAt = "2026-10-01T05:00:00.000Z";

function offer(over: Partial<Offer>): Offer {
  return {
    providerId: "a",
    providerName: "Dist A",
    manufacturer: "Mock Semi",
    mpn: "X-1",
    description: "Op-Amp",
    stock: 100,
    priceBreaks: [{ minQty: 1, unitPrice: 1.5 }],
    moq: 1,
    currency: "USD",
    productUrl: "https://example.com/a",
    lifecycle: "active",
    fetchedAt,
    ...over,
  };
}

function ok(o: Offer, kind: "authorized" | "broker" = "authorized"): ProviderResult {
  return { status: "ok", kind, providerId: o.providerId, providerName: o.providerName, offers: [o], fetchedAt };
}

describe("buildPartSummary", () => {
  it("재고·가격·출처·조회 시각을 담은 답변을 만든다", () => {
    const s = buildPartSummary("X-1", [
      ok(offer({})),
      ok(offer({ providerId: "b", providerName: "Dist B", stock: 50, priceBreaks: [{ minQty: 1, unitPrice: 1.2 }] })),
    ]);
    expect(s.hasAuthorizedOffers).toBe(true);
    expect(s.inStockSourceCount).toBe(2);
    expect(s.manufacturers).toEqual(["Mock Semi"]);
    const stock = s.faq.find((f) => f.question === "X-1 재고가 있나요?")!;
    expect(stock.answer).toContain("2026. 10. 01. 14:00 기준");
    expect(stock.answer).toContain("Dist A 100개");
    expect(stock.answer).toContain("Dist B 50개");
    const price = s.faq.find((f) => f.question === "X-1 가격은 얼마인가요?")!;
    expect(price.answer).toContain("Dist B의 US$1.20");
    expect(s.headline.startsWith("Mock Semi의 X-1 (Op-Amp).")).toBe(true);
  });

  it("broker 결과는 요약에 쓰지 않는다", () => {
    const s = buildPartSummary("X-1", [ok(offer({ providerName: "Broker Z", stock: 9999 }), "broker")]);
    expect(s.hasAuthorizedOffers).toBe(false);
    expect(JSON.stringify(s)).not.toContain("Broker Z");
  });

  it("결과가 없으면 색인 대상이 아니고, 소싱 안내를 한다", () => {
    const s = buildPartSummary("NOPE", [
      { status: "no_results", kind: "authorized", providerId: "a", providerName: "Dist A", fetchedAt },
    ]);
    expect(s.hasAuthorizedOffers).toBe(false);
    expect(s.faq[0].answer).toContain("검색 결과가 없습니다");
    expect(s.faq.some((f) => f.question.includes("가격"))).toBe(false);
  });

  it("재고 0이면 0개라고 답한다", () => {
    const s = buildPartSummary("X-1", [ok(offer({ stock: 0 }))]);
    expect(s.faq[0].answer).toContain("재고가 0개");
    expect(s.inStockSourceCount).toBe(0);
  });

  it("단종·NRND면 유통사 표기를 인용한다", () => {
    const s = buildPartSummary("X-1", [ok(offer({ lifecycle: "nrnd" }))]);
    expect(s.faq.find((f) => f.question === "X-1 단종 여부는?")!.answer).toContain("Dist A: 신규 설계 비권장(NRND)");
  });

  it("견적 안내 FAQ는 항상 포함한다", () => {
    expect(buildPartSummary("X-1", []).faq.at(-1)!.question).toBe("X-1 견적은 어떻게 받나요?");
  });
});

describe("partPath", () => {
  it("정규화하고 URL 인코딩한다", () => {
    expect(partPath(" lm358-n/nopb ")).toBe("/part/LM358-N%2FNOPB");
  });
});
