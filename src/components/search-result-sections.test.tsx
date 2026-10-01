import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchResultSections } from "@/components/search-result-sections";
import { SOURCING_DISCLAIMER } from "@/components/sourcing-inquiry-box";
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

describe("결과 화면 A/B/C 영역", () => {
  it("A → B → C 순서로 렌더링한다", () => {
    const html = render([ok(offer("a", 1, 10))]);
    const a = html.indexOf('id="distributor-results-heading"');
    const b = html.indexOf('id="quote-inquiry-heading"');
    const c = html.indexOf('id="sourcing-inquiry-heading"');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("견적 문의(B)와 소싱 고지 문구는 결과가 있든 없든 항상 노출한다", () => {
    const noResults: ProviderResult = { status: "no_results", kind: "authorized", providerId: "a", providerName: "Dist a", fetchedAt };
    for (const results of [[ok(offer("a", 1, 10))], [noResults]]) {
      const html = render(results);
      expect(html).toContain("이 부품의 견적을 받아보세요.");
      expect(html).toContain(SOURCING_DISCLAIMER);
    }
  });

  it("강조 조건에 해당하면 C만 강조되고, A의 순서(유통사명 순)는 그대로다", () => {
    // 재고 0 → 소싱 강조. A는 유통사명 순 (Dist a → Dist b)
    const html = render([ok(offer("a", 2, 0)), ok(offer("b", 1, 0))]);
    expect(html).toContain('data-emphasized="true"');
    expect(html.indexOf("Dist a")).toBeLessThan(html.indexOf("Dist b"));
    expect(html.indexOf("Dist b")).toBeLessThan(html.indexOf('id="quote-inquiry-heading"'));
  });

  it("강조 조건이 없으면 C는 강조하지 않는다", () => {
    expect(render([ok(offer("a", 1, 10))], 5)).toContain('data-emphasized="false"');
  });

  it("broker 소스 결과는 A·강조 판정에 섞지 않고 소싱 박스(C) 안에만 표시한다", () => {
    const brokerOffer = { ...offer("brk", 0.01, 99999), providerName: "Broker Z" };
    const broker: ProviderResult = { ...ok(brokerOffer), kind: "broker" };
    const html = render([ok(offer("a", 1, 0)), broker], 10);
    expect(html.indexOf("Broker Z")).toBeGreaterThan(html.indexOf('id="sourcing-inquiry-heading"'));
    expect(html).toContain("99,999개 게시");
    expect(html).toContain('href="https://example.com/brk/X-1"');
    // 브로커 가격은 표시하지 않는다
    expect(html).not.toContain("US$0.01");
    // authorized 재고가 모두 0이므로 broker 재고와 무관하게 강조
    expect(html).toContain('data-emphasized="true"');
  });

  it("가격은 어디에도 표시하지 않는다", () => {
    const html = render([ok(offer("a", 1.23, 10))], 5);
    // 금액 표기(통화 기호·단가·합계)가 없어야 한다. "가격은 견적 문의로 안내" 같은 안내 문구는 허용.
    expect(html).not.toMatch(/US\$|₩|\$\s?\d|1\.23|단가|합계/);
  });

  it("문의 링크에 품번과 수량을 넘긴다", () => {
    const html = render([ok(offer("a", 1, 10))], 5);
    expect(html).toContain('href="/inquiry/quote?mpn=X-1&amp;qty=5"');
    expect(html).toContain('href="/inquiry/sourcing?mpn=X-1&amp;qty=5"');
  });
});
