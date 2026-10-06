import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchResultSections } from "@/components/search-result-sections";
import { SOURCING_DISCLAIMER } from "@/components/request-cta";
import type { Offer, ProviderResult } from "@/lib/providers/types";

const fetchedAt = "2026-10-01T05:00:00.000Z";

function offer(providerId: string, unitPrice: number, stock: number): Offer {
  return {
    providerId,
    providerName: `Dist ${providerId}`,
    manufacturer: "M",
    mpn: "X-1",
    description: "desc",
    stock,
    priceBreaks: [{ minQty: 1, unitPrice }],
    moq: 1,
    currency: "USD",
    productUrl: `https://example.com/${providerId}/X-1`,
    lifecycle: "active",
    fetchedAt,
  };
}

function ok(o: Offer): ProviderResult {
  return { status: "ok", kind: "authorized", providerId: o.providerId, providerName: o.providerName, offers: [o], fetchedAt };
}

function render(results: ProviderResult[], qty: number | null = null) {
  return renderToStaticMarkup(<SearchResultSections results={results} mpn="X-1" qty={qty} />);
}

describe("결과 화면: 부품 요청 → 참고용 재고", () => {
  it("부품 요청이 맨 위, 정식 유통사 재고는 그 아래 참고 영역에 있다", () => {
    const html = render([ok(offer("a", 1, 10))]);
    const req = html.indexOf('id="request-cta-heading"');
    const a = html.indexOf('id="distributor-results-heading"');
    expect(req).toBeGreaterThanOrEqual(0);
    expect(req).toBeLessThan(a);
    expect(html).toContain("참고: 정식 유통사 재고 현황");
  });

  it("요청 영역과 소싱 고지 문구는 결과가 있든 없든 항상 노출한다", () => {
    const noResults: ProviderResult = { status: "no_results", kind: "authorized", providerId: "a", providerName: "Dist a", fetchedAt };
    for (const results of [[ok(offer("a", 1, 10))], [noResults]]) {
      const html = render(results);
      expect(html).toContain("이 부품 요청하기");
      expect(html).toContain(SOURCING_DISCLAIMER);
    }
  });

  it("강조 조건에 해당하면 요청 영역만 강조되고, 재고 표의 순서(유통사명 순)는 그대로다", () => {
    const html = render([ok(offer("a", 2, 0)), ok(offer("b", 1, 0))]);
    expect(html).toContain('data-emphasized="true"');
    expect(html).toContain("정식 유통사 재고가 모두 0입니다.");
    expect(html.indexOf("Dist a")).toBeLessThan(html.indexOf("Dist b"));
  });

  it("강조 조건이 없으면 강조하지 않는다", () => {
    expect(render([ok(offer("a", 1, 10))], 5)).toContain('data-emphasized="false"');
  });

  it("broker 소스 결과는 정식 유통사 표·강조 판정에 섞지 않고 시장 재고 참고에만 표시한다", () => {
    const brokerOffer = { ...offer("brk", 0.01, 99999), providerName: "Broker Z" };
    const broker: ProviderResult = { ...ok(brokerOffer), kind: "broker" };
    const html = render([ok(offer("a", 1, 0)), broker], 10);
    expect(html.indexOf("Broker Z")).toBeGreaterThan(html.indexOf('id="broker-listings-heading"'));
    expect(html.indexOf('id="distributor-results-heading"')).toBeLessThan(html.indexOf('id="broker-listings-heading"'));
    expect(html).toContain("99,999개 게시");
    expect(html).toContain('href="https://example.com/brk/X-1"');
    expect(html).not.toContain("US$0.01");
    expect(html).toContain('data-emphasized="true"');
  });

  it("가격은 어디에도 표시하지 않는다", () => {
    const html = render([ok(offer("a", 1.23, 10))], 5);
    expect(html).not.toMatch(/US\$|₩|\$\s?\d|1\.23|단가|합계/);
  });

  it("요청 링크에 품번과 수량을 넘긴다", () => {
    const html = render([ok(offer("a", 1, 10))], 5);
    expect(html).toContain('href="/request?mpn=X-1&amp;qty=5"');
  });
});
