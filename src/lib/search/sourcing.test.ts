import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnabledProviders } from "@/lib/providers/registry";
import type { Offer, ProviderResult } from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";
import { toSearchQuery } from "@/lib/search/normalize";
import { searchParts } from "@/lib/search/search-parts";
import { evaluateSourcingSignals } from "@/lib/search/sourcing";

/** mock fixture로 실제 검색 흐름을 거친 뒤 강조 조건을 판정한다. */
async function signalsFor(mpn: string, qty: number | null) {
  const results = await searchParts(toSearchQuery(mpn), {
    providers: getEnabledProviders(),
    cache: new TtlCache<ProviderResult>(),
    timeoutMs: 1000,
  });
  return evaluateSourcingSignals(results, qty);
}

beforeEach(() => {
  vi.stubEnv("PROVIDER_MOCK_ENABLED", "true");
  vi.stubEnv("PROVIDER_MOUSER_ENABLED", "false");
  vi.stubEnv("PROVIDER_DIGIKEY_ENABLED", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("소싱 강조 조건: fixture 시나리오", () => {
  it("재고 충분: 강조하지 않는다", async () => {
    expect(await signalsFor("MOCK-STOCK-OK", null)).toEqual({ emphasize: false, reasons: [] });
    expect(await signalsFor("MOCK-STOCK-OK", 5000)).toEqual({ emphasize: false, reasons: [] });
  });

  it("재고 0: 모든 유통사 재고 0이면 강조", async () => {
    expect(await signalsFor("MOCK-STOCK-ZERO", null)).toEqual({ emphasize: true, reasons: ["all_zero_stock"] });
  });

  it("결과 없음: 모든 유통사 결과 없음이면 강조", async () => {
    expect(await signalsFor("NOT-IN-FIXTURE", null)).toEqual({ emphasize: true, reasons: ["no_results"] });
  });

  it("수량 초과: 입력 수량 > 최대 재고(30)이면 강조", async () => {
    expect(await signalsFor("MOCK-LOW-STOCK", 30)).toEqual({ emphasize: false, reasons: [] });
    expect(await signalsFor("MOCK-LOW-STOCK", 31)).toEqual({ emphasize: true, reasons: ["qty_exceeds_stock"] });
  });

  it("수량 초과는 수량 입력이 있을 때만 판단한다", async () => {
    expect(await signalsFor("MOCK-LOW-STOCK", null)).toEqual({ emphasize: false, reasons: [] });
  });

  it("단종·NRND: 강조", async () => {
    expect(await signalsFor("MOCK-NRND", null)).toEqual({ emphasize: true, reasons: ["discontinued"] });
  });

  it("단종 + 수량 초과: 이유를 모두 표시", async () => {
    expect(await signalsFor("MOCK-NRND", 1000)).toEqual({
      emphasize: true,
      reasons: ["qty_exceeds_stock", "discontinued"],
    });
  });

  it("일부 유통사 조회 실패: 조회된 결과만으로 판단 (재고 충분이면 강조 안 함)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await signalsFor("MOCK-PARTIAL-ERROR", 10)).toEqual({ emphasize: false, reasons: [] });
  });
});

describe("소싱 강조 조건: 경계 케이스", () => {
  const base: Omit<Offer, "stock" | "lifecycle"> = {
    providerId: "p",
    providerName: "P",
    manufacturer: "M",
    mpn: "X",
    description: "",
    priceBreaks: [],
    moq: null,
    currency: "USD",
    productUrl: "https://example.com/x",
    fetchedAt: "2026-10-01T00:00:00.000Z",
  };
  const ok = (offers: Offer[]): ProviderResult => ({
    status: "ok",
    kind: "authorized",
    providerId: "p",
    providerName: "P",
    offers,
    fetchedAt: base.fetchedAt,
  });

  it("Provider가 하나도 없으면 강조하지 않는다", () => {
    expect(evaluateSourcingSignals([], 10)).toEqual({ emphasize: false, reasons: [] });
  });

  it("모든 Provider 조회 실패는 '결과 없음'으로 보지 않는다", () => {
    const failed: ProviderResult = {
      status: "unavailable",
      kind: "authorized",
      providerId: "p",
      providerName: "P",
      reason: "error",
      fetchedAt: base.fetchedAt,
    };
    expect(evaluateSourcingSignals([failed], null)).toEqual({ emphasize: false, reasons: [] });
  });

  it("재고 미상(null)은 재고 0으로 보지 않는다", () => {
    const r = ok([{ ...base, stock: null, lifecycle: "active" }]);
    expect(evaluateSourcingSignals([r], 100)).toEqual({ emphasize: false, reasons: [] });
  });

  it("재고 미상과 재고 0이 섞이면 알려진 재고만으로 판단한다", () => {
    const r = ok([
      { ...base, stock: null, lifecycle: "active" },
      { ...base, stock: 0, lifecycle: "active" },
    ]);
    expect(evaluateSourcingSignals([r], null).reasons).toEqual(["all_zero_stock"]);
  });

  it("EOL도 단종으로 본다", () => {
    const r = ok([{ ...base, stock: 100, lifecycle: "eol" }]);
    expect(evaluateSourcingSignals([r], null).reasons).toEqual(["discontinued"]);
  });
});
