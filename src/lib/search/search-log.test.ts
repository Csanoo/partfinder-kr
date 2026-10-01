import { describe, expect, it, vi } from "vitest";
import type { ProviderResult } from "@/lib/providers/types";
import { toSearchQuery } from "@/lib/search/normalize";
import { isBot, logSearch, toSearchLogRecord, type SearchLogRepo } from "@/lib/search/search-log";

const fetchedAt = "2026-10-01T05:00:00.000Z";
const base = { manufacturer: "M", mpn: "X", description: "", priceBreaks: [], moq: null, currency: "USD", productUrl: "https://e.x", lifecycle: "active" as const, fetchedAt };

const results: ProviderResult[] = [
  { status: "ok", kind: "authorized", providerId: "a", providerName: "A", fetchedAt, offers: [{ ...base, providerId: "a", providerName: "A", stock: 0 }] },
  { status: "no_results", kind: "authorized", providerId: "b", providerName: "B", fetchedAt },
  { status: "unavailable", kind: "authorized", providerId: "c", providerName: "C", reason: "rate_limited", fetchedAt },
  { status: "ok", kind: "broker", providerId: "z", providerName: "Z", fetchedAt, offers: [{ ...base, providerId: "z", providerName: "Z", stock: 500 }] },
];

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

describe("toSearchLogRecord", () => {
  it("Provider별 결과 수(조회 불가는 null), 재고 유무는 정식 유통사 기준", () => {
    const rec = toSearchLogRecord(toSearchQuery(" uln 2003a "), 10, results, "sid", "search");
    expect(rec).toEqual({
      queryRaw: " uln 2003a ",
      queryNormalized: "ULN2003A",
      qty: 10,
      resultCountByProvider: { a: 1, b: 0, c: null, z: 1 },
      hasAnyStock: false, // 브로커 재고 500은 반영하지 않음
      sessionId: "sid",
      source: "search",
    });
  });
});

describe("isBot", () => {
  it.each([
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true],
    ["Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)", true],
    ["Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html?faqId=28966) Daumoa", true],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)", true],
    ["curl/8.0", true],
    ["", true],
    [null, true],
    [BROWSER, false],
  ])("%s → %s", (ua, expected) => {
    expect(isBot(ua)).toBe(expected);
  });
});

describe("logSearch", () => {
  const args = { query: toSearchQuery("X"), qty: null, results, sessionId: null, source: "search" as const };

  it("사람 방문은 저장하고 id를 돌려준다", async () => {
    const repo: SearchLogRepo = { create: vi.fn(async () => ({ id: "log-1" })) };
    expect(await logSearch(repo, { ...args, userAgent: BROWSER })).toBe("log-1");
  });

  it("봇은 저장하지 않는다", async () => {
    const repo: SearchLogRepo = { create: vi.fn(async () => ({ id: "x" })) };
    expect(await logSearch(repo, { ...args, userAgent: "Googlebot/2.1" })).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("DB 오류가 나도 예외를 던지지 않는다 (검색 화면 정상 동작)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const repo: SearchLogRepo = { create: vi.fn(async () => { throw new Error("db down"); }) };
    expect(await logSearch(repo, { ...args, userAgent: BROWSER })).toBeNull();
  });
});
