import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { getEnabledProviders } from "@/lib/providers/registry";
import { ProviderError, type PartProvider, type ProviderResult } from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";
import { toSearchQuery } from "@/lib/search/normalize";
import { searchParts } from "@/lib/search/search-parts";

const fixedNow = () => new Date("2026-10-01T05:00:00.000Z");

function run(raw: string, providers: PartProvider[], cache = new TtlCache<ProviderResult>()) {
  return searchParts(toSearchQuery(raw), { providers, cache, now: fixedNow, timeoutMs: 1000, cacheTtlSeconds: 900 });
}

function mockProviders() {
  vi.stubEnv("PROVIDER_MOCK_ENABLED", "true");
  return getEnabledProviders();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("provider registry", () => {
  it("플래그가 없으면 어떤 Provider도 켜지지 않는다", () => {
    vi.stubEnv("PROVIDER_MOCK_ENABLED", "");
    vi.stubEnv("PROVIDER_MOUSER_ENABLED", "");
    vi.stubEnv("PROVIDER_DIGIKEY_ENABLED", "");
    expect(getEnabledProviders()).toEqual([]);
  });

  it("mock 플래그를 켜면 mock Provider만 켜진다", () => {
    vi.stubEnv("PROVIDER_MOUSER_ENABLED", "false");
    vi.stubEnv("PROVIDER_DIGIKEY_ENABLED", "false");
    expect(mockProviders().map((p) => p.id)).toEqual(["mock-a", "mock-b"]);
  });

  it("미구현 Provider는 플래그를 켜도 외부 호출 없이 조회 불가로 처리된다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("PROVIDER_DIGIKEY_ENABLED", "true");
    const results = await run("ANY", getEnabledProviders());
    expect(results.find((r) => r.providerId === "digikey")?.status).toBe("unavailable");
  });
});

describe("searchParts with mock fixtures", () => {
  it("Provider별로 결과를 분리하고 출처(유통사명·조회 시각·링크)를 붙인다", async () => {
    const results = await run("mock-stock-ok", mockProviders());
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.status).toBe("ok");
      if (r.status !== "ok") continue;
      for (const o of r.offers) {
        expect(o.providerId).toBe(r.providerId);
        expect(o.providerName).toBe(r.providerName);
        expect(o.fetchedAt).toBe("2026-10-01T05:00:00.000Z");
        expect(o.productUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("공백·소문자가 섞인 검색어도 정규화해서 찾는다", async () => {
    const results = await run("  Mock-Stock-ok ", mockProviders());
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });

  it("결과가 없으면 no_results", async () => {
    const results = await run("NOT-IN-FIXTURE", mockProviders());
    expect(results.map((r) => r.status)).toEqual(["no_results", "no_results"]);
  });

  it("한 Provider가 실패해도 나머지는 정상 반환한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const results = await run("MOCK-PARTIAL-ERROR", mockProviders());
    expect(results[0].status).toBe("ok");
    expect(results[1]).toMatchObject({ status: "unavailable", providerId: "mock-b", reason: "rate_limited" });
  });

  it("빈 검색어는 Provider를 호출하지 않는다", async () => {
    const provider: PartProvider = { id: "p", displayName: "P", kind: "authorized", search: vi.fn(async () => []) };
    expect(await run("   ", [provider])).toEqual([]);
    expect(provider.search).not.toHaveBeenCalled();
  });
});

describe("searchParts error handling and cache", () => {
  it("응답이 늦으면 timeout으로 조회 불가 처리", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const slow: PartProvider = { id: "slow", displayName: "Slow", kind: "authorized", search: () => new Promise(() => {}) };
    const results = await searchParts(toSearchQuery("X"), {
      providers: [slow],
      cache: new TtlCache(),
      now: fixedNow,
      timeoutMs: 10,
    });
    expect(results[0]).toMatchObject({ status: "unavailable", reason: "timeout" });
  });

  it("일반 예외는 reason=error 로 처리", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: PartProvider = {
      id: "broken",
      displayName: "Broken",
      kind: "authorized",
      search: async () => {
        throw new Error("boom");
      },
    };
    expect((await run("X", [broken]))[0]).toMatchObject({ status: "unavailable", reason: "error" });
  });

  it("TTL 안에서는 캐시를 쓰고, 만료되면 다시 조회한다", async () => {
    let t = 0;
    const cache = new TtlCache<ProviderResult>(() => t);
    const search = vi.fn(async () => []);
    const provider: PartProvider = { id: "p", displayName: "P", kind: "authorized", search };

    await run("X", [provider], cache);
    t += 899_000;
    await run("x", [provider], cache);
    expect(search).toHaveBeenCalledTimes(1);

    t += 2_000;
    await run("X", [provider], cache);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("조회 실패 결과는 캐시하지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const search = vi.fn(async () => {
      throw new ProviderError("rate_limited");
    });
    const provider: PartProvider = { id: "p", displayName: "P", kind: "authorized", search };
    const cache = new TtlCache<ProviderResult>();
    await run("X", [provider], cache);
    await run("X", [provider], cache);
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe("searchParts with rate limiter", () => {
  function runLimited(raw: string, providers: PartProvider[], limiter: ProviderRateLimiter) {
    return searchParts(toSearchQuery(raw), {
      providers,
      limiter,
      cache: new TtlCache<ProviderResult>(),
      now: fixedNow,
      timeoutMs: 1000,
    });
  }

  it("한도에 걸린 Provider만 조회 불가, 나머지는 정상", async () => {
    const limiter = new ProviderRateLimiter();
    const limited: PartProvider = {
      id: "limited",
      displayName: "Limited",
      kind: "authorized",
      rateLimit: { perDay: 1 },
      search: vi.fn(async () => []),
    };
    const free: PartProvider = { id: "free", displayName: "Free", kind: "authorized", search: vi.fn(async () => []) };

    await runLimited("A", [limited, free], limiter);
    const results = await runLimited("B", [limited, free], limiter);
    expect(results[0]).toMatchObject({ providerId: "limited", status: "unavailable", reason: "quota_exceeded" });
    expect(results[1]).toMatchObject({ providerId: "free", status: "no_results" });
    expect(limited.search).toHaveBeenCalledTimes(1);
  });

  it("blocked 응답을 받으면 쿨다운 동안 다시 요청하지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limiter = new ProviderRateLimiter();
    const search = vi.fn(async () => {
      throw new ProviderError("blocked");
    });
    const provider: PartProvider = {
      id: "b",
      displayName: "B",
      kind: "broker",
      rateLimit: { blockCooldownMs: 60_000 },
      search,
    };
    await runLimited("A", [provider], limiter);
    const results = await runLimited("B", [provider], limiter);
    expect(results[0]).toMatchObject({ status: "unavailable", reason: "blocked" });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("결과에 소스 분류(kind)를 붙인다", async () => {
    const broker: PartProvider = { id: "x", displayName: "X", kind: "broker", search: async () => [] };
    expect((await runLimited("A", [broker], new ProviderRateLimiter()))[0].kind).toBe("broker");
  });
});
