import { describe, expect, it, vi } from "vitest";
import { getAvailability, summarizeAvailability } from "@/lib/availability";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import type { Offer, PartProvider, ProviderResult } from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";
const fetchedAt = "2026-10-01T05:00:00.000Z";

function offer(over: Partial<Offer>): Offer {
  return {
    providerId: "a",
    providerName: "Dist A",
    manufacturer: "M",
    mpn: "X",
    description: "",
    stock: 10,
    priceBreaks: [{ minQty: 1, unitPrice: 9.99 }],
    moq: 1,
    currency: "USD",
    productUrl: "https://dist-a.example/x",
    lifecycle: "active",
    fetchedAt,
    ...over,
  };
}

const ok = (offers: Offer[], kind: "authorized" | "broker" = "authorized"): ProviderResult => ({
  status: "ok",
  kind,
  providerId: offers[0].providerId,
  providerName: offers[0].providerName,
  offers,
  fetchedAt,
});

describe("summarizeAvailability", () => {
  it("재고 있음/없음/미표기, 결과 없음, 조회 불가를 구분하고 유통사명 순", () => {
    const rows = summarizeAvailability([
      ok([offer({ providerName: "Dist C", stock: 0, productUrl: "https://c/x" })]),
      ok([offer({ providerName: "Dist A", stock: 0 }), offer({ providerName: "Dist A", stock: 5, productUrl: "https://a/in-stock" })]),
      ok([offer({ providerName: "Dist D", stock: null, productUrl: "https://d/x" })]),
      { status: "no_results", kind: "authorized", providerId: "b", providerName: "Dist B", fetchedAt },
      { status: "unavailable", kind: "authorized", providerId: "e", providerName: "Dist E", reason: "quota_exceeded", fetchedAt },
    ]);
    expect(rows.map((r) => [r.providerName, r.status, r.url])).toEqual([
      ["Dist A", "in_stock", "https://a/in-stock"],
      ["Dist B", "no_results", null],
      ["Dist C", "out_of_stock", "https://c/x"],
      ["Dist D", "unknown", "https://d/x"],
      ["Dist E", "unavailable", null],
    ]);
  });

  it("가격·정확한 수량은 응답에 없다", () => {
    const json = JSON.stringify(summarizeAvailability([ok([offer({ stock: 12345 })])]));
    expect(json).not.toMatch(/12345|9\.99|price|"stock"|"qty"/i);
  });

  it("브로커 결과는 넣지 않는다", () => {
    expect(summarizeAvailability([ok([offer({ providerName: "Broker" })], "broker")])).toEqual([]);
  });
});

describe("getAvailability", () => {
  function provider(kind: "authorized" | "broker", name: string) {
    const search = vi.fn(async () => [{ ...offer({ providerName: name }), providerId: name }]);
    return { p: { id: name, displayName: name, kind, search } as PartProvider, search };
  }
  const opts = () => ({ limiter: new ProviderRateLimiter(), search: { cache: new TtlCache<ProviderResult>(), timeoutMs: 1000 } });

  it("검색엔진 봇이면 유통사를 호출하지 않는다", async () => {
    const a = provider("authorized", "A");
    for (const ua of ["Googlebot/2.1", "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)", null]) {
      expect(await getAvailability("LM358", ua, "1.1.1.1", { ...opts(), providers: [a.p] })).toEqual({ kind: "bot" });
    }
    expect(a.search).not.toHaveBeenCalled();
  });

  it("정식 유통사 Provider 만 호출한다", async () => {
    const a = provider("authorized", "A");
    const b = provider("broker", "B");
    const r = await getAvailability("LM358", BROWSER, "1.1.1.1", { ...opts(), providers: [a.p, b.p] });
    expect(r.kind).toBe("ok");
    expect(a.search).toHaveBeenCalledTimes(1);
    expect(b.search).not.toHaveBeenCalled();
  });

  it("품번이 비었거나 너무 길면 invalid", async () => {
    expect((await getAvailability("", BROWSER, "1.1.1.1", opts())).kind).toBe("invalid");
    expect((await getAvailability("X".repeat(65), BROWSER, "1.1.1.1", opts())).kind).toBe("invalid");
  });

  it("같은 IP 분당 한도를 넘으면 rate_limited", async () => {
    const a = provider("authorized", "A");
    const o = { ...opts(), providers: [a.p] };
    for (let i = 0; i < 30; i++) expect((await getAvailability(`P${i}`, BROWSER, "9.9.9.9", o)).kind).toBe("ok");
    expect((await getAvailability("P31", BROWSER, "9.9.9.9", o)).kind).toBe("rate_limited");
  });
});
