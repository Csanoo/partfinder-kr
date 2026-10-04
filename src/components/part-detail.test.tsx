import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartDetail } from "@/components/part-detail";
import { buildDescription, buildJsonLd, buildRobots, buildTitle, type PartPageModel } from "@/lib/parts/page-model";
import { validateJsonLd, visibleTextValues } from "@/lib/seo/validate-json-ld";

const SITE = "https://example.kr";

function model(over: Partial<PartPageModel> = {}): PartPageModel {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    mpnDisplay: "LM358-N/NOPB",
    manufacturer: { slug: "texas-instruments", nameEn: "Texas Instruments", nameKo: "텍사스 인스트루먼트" },
    category: { slug: "amplifiers", nameKo: "증폭기", nameEn: "Amplifiers" },
    package: "SOIC-8",
    summaryKo:
      "LM358-N/NOPB는 텍사스 인스트루먼트의 2채널 범용 연산 증폭기입니다. 2026년 10월 기준 단종(EOL) 상태이며, 핀 호환 대체품 1종이 확인되어 있습니다.",
    keySpecs: [
      { label: "채널 수", value: "2" },
      { label: "공급 전압", value: "3~32 V" },
      { label: "대역폭", value: "0.7 MHz" },
    ],
    lifecycle: {
      status: "eol",
      checkedAt: new Date("2026-09-15T00:00:00Z"),
      source: "제조사 PCN #20260901",
      eolDate: new Date("2027-03-31T00:00:00Z"),
    },
    datasheetUrl: "https://www.ti.com/lit/ds/symlink/lm158-n.pdf",
    alternatives: [
      { mpn: "LM358BIDR", manufacturerName: "Texas Instruments", path: "/parts/texas-instruments/lm358bidr", relation: "drop_in", noteKo: "핀 배치 동일", verified: true },
      { mpn: "MCP6002-I/SN", manufacturerName: null, path: null, relation: "similar", noteKo: null, verified: false },
    ],
    faqs: [{ questionKo: "LM358-N/NOPB 대체품이 있나요?", answerKo: "핀 호환 대체품으로 LM358BIDR이 확인되어 있습니다." }],
    related: [{ mpn: "LM324-N/NOPB", manufacturerName: "Texas Instruments", path: "/parts/texas-instruments/lm324-n_nopb" }],
    path: "/parts/texas-instruments/lm358-n_nopb",
    indexable: true,
    ...over,
  };
}

const render = (p: PartPageModel) =>
  renderToStaticMarkup(<PartDetail part={p} availability={<div>AVAIL</div>} sourcingForm={<div>FORM</div>} />);

/** HTML 엔티티를 풀어 화면 텍스트로 비교 */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

describe("메타 태그 (5.2)", () => {
  it("title: 단종 계열은 '단종·대체품·재고 문의', active는 '재고·구매 문의'", () => {
    expect(buildTitle(model())).toBe("LM358-N/NOPB 단종·대체품·재고 문의 | Texas Instruments");
    for (const status of ["nrnd", "ltb", "unknown"] as const) {
      expect(buildTitle(model({ lifecycle: { ...model().lifecycle, status } }))).toContain("단종·대체품·재고 문의");
    }
    expect(buildTitle(model({ lifecycle: { ...model().lifecycle, status: "active" } }))).toBe(
      "LM358-N/NOPB 재고·구매 문의 | Texas Instruments",
    );
  });

  it("title 은 60자 내외", () => {
    expect([...buildTitle(model())].length).toBeLessThanOrEqual(65);
  });

  it("description: 120자 이내, 문장 경계에서 자른다", () => {
    const d = buildDescription(model().summaryKo);
    expect([...d].length).toBeLessThanOrEqual(120);
    expect(d.endsWith("다.") || d.endsWith("…")).toBe(true);
  });

  it("description: 짧은 요약은 그대로, 없으면 빈 문자열, 문장 경계가 없으면 말줄임", () => {
    expect(buildDescription("짧은 요약입니다.")).toBe("짧은 요약입니다.");
    expect(buildDescription(null)).toBe("");
    const long = "가".repeat(200);
    expect(buildDescription(long)).toBe(`${"가".repeat(119)}…`);
  });

  it("robots: indexable=false 면 noindex, follow", () => {
    expect(buildRobots(false)).toEqual({ index: false, follow: true });
    expect(buildRobots(true)).toEqual({ index: true, follow: true });
  });
});

describe("JSON-LD (5.4) 스키마 검증", () => {
  it("Product·BreadcrumbList·FAQPage 가 검증을 통과한다", () => {
    const ld = buildJsonLd(model(), SITE);
    expect(ld.map((n) => n["@type"])).toEqual(["Product", "BreadcrumbList", "FAQPage"]);
    expect(validateJsonLd(ld)).toEqual([]);
  });

  it("Product 에 offers·price·aggregateRating·review 가 없다", () => {
    const json = JSON.stringify(buildJsonLd(model(), SITE));
    for (const k of ["offers", "price", "aggregateRating", "review"]) expect(json).not.toContain(`"${k}"`);
  });

  it("Product: name, mpn, brand(Organization), category, description(summary_ko), url", () => {
    const [product] = buildJsonLd(model(), SITE);
    expect(product).toMatchObject({
      name: "LM358-N/NOPB",
      mpn: "LM358-N/NOPB",
      brand: { "@type": "Organization", name: "Texas Instruments" },
      category: "증폭기",
      description: model().summaryKo,
      url: "https://example.kr/parts/texas-instruments/lm358-n_nopb",
    });
  });

  it("Breadcrumb: 홈 > 카테고리 > 제조사 > 부품", () => {
    const [, bc] = buildJsonLd(model(), SITE) as { itemListElement: { name: string; item: string }[] }[];
    expect(bc.itemListElement.map((i) => i.name)).toEqual(["홈", "증폭기", "Texas Instruments", "LM358-N/NOPB"]);
    expect(bc.itemListElement.map((i) => new URL(i.item).pathname)).toEqual([
      "/",
      "/categories/amplifiers",
      "/manufacturers/texas-instruments",
      "/parts/texas-instruments/lm358-n_nopb",
    ]);
  });

  it("카테고리가 없으면 breadcrumb 에서 빠지고 position 이 이어진다", () => {
    const ld = buildJsonLd(model({ category: null }), SITE);
    expect(validateJsonLd(ld)).toEqual([]);
    expect(ld[0]).not.toHaveProperty("category");
  });

  it("게시 FAQ 가 없으면 FAQPage 를 넣지 않는다", () => {
    const ld = buildJsonLd(model({ faqs: [] }), SITE);
    expect(ld.map((n) => n["@type"])).toEqual(["Product", "BreadcrumbList"]);
    expect(validateJsonLd(ld)).toEqual([]);
  });

  it("요약이 없으면 description 을 넣지 않는다", () => {
    expect(buildJsonLd(model({ summaryKo: null }), SITE)[0]).not.toHaveProperty("description");
  });

  it("검증기가 금지 속성·빈 FAQ·잘못된 position 을 잡아낸다", () => {
    const errors = validateJsonLd([
      { "@context": "https://schema.org", "@type": "Product", name: "X", offers: { price: 1 } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [{ "@type": "ListItem", position: 2, name: "a", item: "/relative" }],
      },
    ]);
    expect(errors.join("\n")).toMatch(/offers: 금지/);
    expect(errors.join("\n")).toMatch(/price: 금지/);
    expect(errors.join("\n")).toMatch(/FAQPage.mainEntity 필수/);
    expect(errors.join("\n")).toMatch(/position 은 1/);
    expect(errors.join("\n")).toMatch(/절대 URL/);
  });

  it("구조화 데이터의 텍스트는 모두 화면에도 보인다 (화면에 없는 내용 금지)", () => {
    const p = model();
    const text = visibleText(render(p));
    for (const v of visibleTextValues(buildJsonLd(p, SITE))) {
      expect(text, `화면에 없음: ${v}`).toContain(v);
    }
  });
});

describe("부품 상세 화면 (5.1)", () => {
  it("구성 순서: H1 → 요약 → 기본 정보 → 수명주기 → 대체품 → 재고 → FAQ → 관련 부품 → 고지", () => {
    const html = render(model());
    const order = [
      "<h1",
      model().summaryKo!.slice(0, 20),
      'id="info-heading"',
      'id="lifecycle-heading"',
      'id="alt-heading"',
      'id="availability-heading"',
      'id="faq-heading"',
      'id="related-heading"',
    ].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("소싱 문의는 별도 영역에 고지 문구와 함께 있다", () => {
    const html = render(model());
    expect(html).toContain('aria-labelledby="sourcing-heading"');
    expect(html).toContain("소싱 부품은 정식 유통 경로가 아니며");
    expect(html).toContain("FORM");
  });

  it("가격은 어디에도 없다", () => {
    expect(visibleText(render(model()))).not.toMatch(/US\$|₩|\$\s?\d|단가|합계/);
  });

  it("대체품: 내부 게시 페이지는 링크, 없으면 텍스트 / 검증 여부 표시", () => {
    const html = render(model());
    expect(html).toContain('href="/parts/texas-instruments/lm358bidr"');
    expect(html).not.toMatch(/<a[^>]*>MCP6002-I\/SN<\/a>/);
    expect(html).toContain("검증됨");
    expect(html).toContain("미검증");
  });

  it("데이터시트는 제조사 링크만, 내용은 복사하지 않는다", () => {
    const html = render(model());
    expect(html).toContain('href="https://www.ti.com/lit/ds/symlink/lm158-n.pdf"');
  });

  it("FAQ·관련 부품이 없으면 해당 영역을 그리지 않는다", () => {
    const html = render(model({ faqs: [], related: [] }));
    expect(html).not.toContain('id="faq-heading"');
    expect(html).not.toContain('id="related-heading"');
  });

  it("H1 에 품번과 제조사명", () => {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(render(model()))![1];
    expect(visibleText(h1)).toContain("LM358-N/NOPB");
    expect(visibleText(h1)).toContain("Texas Instruments");
  });
});
