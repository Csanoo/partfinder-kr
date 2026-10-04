import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HubView } from "@/components/hub-view";
import { hubMetadata } from "@/lib/parts/hub-metadata";
import { buildHubJsonLd, HUB_PAGE_SIZE, hubIndexable, hubMinParts, pagePath, parsePage, type HubModel } from "@/lib/parts/hubs";
import { validateJsonLd } from "@/lib/seo/validate-json-ld";

afterEach(() => vi.unstubAllEnvs());

function hub(over: Partial<HubModel> = {}): HubModel {
  return {
    kind: "manufacturer",
    title: "Texas Instruments 부품",
    intro: "MS유통에 등록된 Texas Instruments 부품 2종의 수명주기와 대체품 정보입니다.",
    path: "/manufacturers/texas-instruments",
    items: [
      { mpn: "LM358-N/NOPB", path: "/parts/texas-instruments/lm358-n_nopb", manufacturerName: "Texas Instruments", categoryName: "증폭기", lifecycle: "eol", eolDate: null },
      { mpn: "SN74HC595N", path: "/parts/texas-instruments/sn74hc595n", manufacturerName: "Texas Instruments", categoryName: null, lifecycle: "active", eolDate: null },
    ],
    total: 2,
    page: 1,
    pageCount: 1,
    indexable: false,
    facets: [{ label: "증폭기", path: "/categories/amplifiers", count: 1 }],
    ...over,
  };
}

describe("허브 색인 기준 (게시 부품 5개 이상)", () => {
  it("4개 noindex, 5개 색인", () => {
    expect(hubIndexable(4)).toBe(false);
    expect(hubIndexable(5)).toBe(true);
  });

  it("기준 값은 환경변수로 조정", () => {
    vi.stubEnv("SEO_HUB_MIN_PARTS", "10");
    expect(hubMinParts()).toBe(10);
    expect(hubIndexable(9)).toBe(false);
    vi.stubEnv("SEO_HUB_MIN_PARTS", "0");
    expect(hubMinParts()).toBe(5);
  });

  it("메타: 기준 미달이면 noindex, follow / 페이지별 self-canonical", () => {
    expect(hubMetadata(hub()).robots).toEqual({ index: false, follow: true });
    expect(hubMetadata(hub({ indexable: true })).robots).toEqual({ index: true, follow: true });
    expect(hubMetadata(hub()).alternates?.canonical).toBe("/manufacturers/texas-instruments");
    expect(hubMetadata(hub({ page: 2, pageCount: 3 })).alternates?.canonical).toBe("/manufacturers/texas-instruments?page=2");
  });
});

describe("페이지 나누기", () => {
  it.each([
    [undefined, 250, 1],
    ["", 250, 1],
    ["3", 250, 3],
    ["4", 250, null],
    ["0", 250, null],
    ["1.5", 250, null],
    ["abc", 250, null],
    ["1", 0, 1],
  ])("parsePage(%j, total=%i) = %j", (raw, total, expected) => {
    expect(parsePage(raw, total)).toBe(expected);
  });

  it("1페이지는 쿼리 없이", () => {
    expect(pagePath("/eol", 1)).toBe("/eol");
    expect(pagePath("/eol", 2)).toBe("/eol?page=2");
  });
});

describe("허브 JSON-LD", () => {
  it("BreadcrumbList + ItemList 가 검증을 통과", () => {
    const ld = buildHubJsonLd(hub(), "https://example.kr", "Texas Instruments");
    expect(ld.map((n) => n["@type"])).toEqual(["BreadcrumbList", "ItemList"]);
    expect(validateJsonLd(ld)).toEqual([]);
  });

  it("2페이지 목록은 position 이 이어진다", () => {
    const [, list] = buildHubJsonLd(hub({ page: 2, pageCount: 2, total: HUB_PAGE_SIZE + 2 }), "https://example.kr", "TI") as {
      itemListElement: { position: number }[];
    }[];
    expect(list.itemListElement.map((i) => i.position)).toEqual([HUB_PAGE_SIZE + 1, HUB_PAGE_SIZE + 2]);
  });

  it("가격 관련 속성이 없다", () => {
    expect(JSON.stringify(buildHubJsonLd(hub(), "https://example.kr", "TI"))).not.toMatch(/offers|price/);
  });
});

describe("HubView", () => {
  const render = (h: HubModel) => renderToStaticMarkup(<HubView hub={h} breadcrumbName="Texas Instruments" />);

  it("부품 링크·수명주기·다른 축 내부 링크·고지 문구", () => {
    const html = render(hub());
    expect(html).toContain('href="/parts/texas-instruments/lm358-n_nopb"');
    expect(html).toContain('href="/categories/amplifiers"');
    expect(html).toContain("단종 (EOL)");
    expect(html).toContain("독립 운영");
  });

  it("여러 페이지면 페이지 링크, 현재 페이지 표시", () => {
    const html = render(hub({ page: 2, pageCount: 3 }));
    expect(html).toContain('href="/manufacturers/texas-instruments"');
    expect(html).toContain('href="/manufacturers/texas-instruments?page=3"');
    expect(html).toMatch(/aria-current="page"[^>]*>2</);
  });

  it("/eol 은 단종 시점 열을 보여 준다", () => {
    const html = render(hub({ kind: "eol", facets: [] }));
    expect(html).toContain("단종 시점");
  });
});
