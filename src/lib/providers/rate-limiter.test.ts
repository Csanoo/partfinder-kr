import { describe, expect, it } from "vitest";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";

function clock(start = Date.parse("2026-10-01T00:00:00.000Z")) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("ProviderRateLimiter", () => {
  it("정책이 없으면 제한하지 않는다", () => {
    const l = new ProviderRateLimiter();
    for (let i = 0; i < 100; i++) expect(l.tryAcquire("p", undefined)).toEqual({ ok: true });
  });

  it("최소 간격보다 빨리 요청하면 rate_limited", () => {
    const c = clock();
    const l = new ProviderRateLimiter(c.now);
    const policy = { minIntervalMs: 3000 };
    expect(l.tryAcquire("p", policy).ok).toBe(true);
    c.advance(2999);
    expect(l.tryAcquire("p", policy)).toEqual({ ok: false, reason: "rate_limited" });
    c.advance(1);
    expect(l.tryAcquire("p", policy).ok).toBe(true);
  });

  it("분당 한도 (Mouser 30회)", () => {
    const c = clock();
    const l = new ProviderRateLimiter(c.now);
    const policy = { perMinute: 30 };
    for (let i = 0; i < 30; i++) {
      expect(l.tryAcquire("mouser", policy).ok).toBe(true);
      c.advance(100);
    }
    expect(l.tryAcquire("mouser", policy)).toEqual({ ok: false, reason: "rate_limited" });
    c.advance(60_000);
    expect(l.tryAcquire("mouser", policy).ok).toBe(true);
  });

  it("일일 한도는 KST 날짜가 바뀌면 초기화된다", () => {
    // 2026-10-01 23:59 KST
    const c = clock(Date.parse("2026-10-01T14:59:00.000Z"));
    const l = new ProviderRateLimiter(c.now);
    const policy = { perDay: 2 };
    expect(l.tryAcquire("p", policy).ok).toBe(true);
    expect(l.tryAcquire("p", policy).ok).toBe(true);
    expect(l.tryAcquire("p", policy)).toEqual({ ok: false, reason: "quota_exceeded" });
    c.advance(60_000); // 2026-10-02 00:00 KST
    expect(l.tryAcquire("p", policy).ok).toBe(true);
  });

  it("차단 보고 후 쿨다운 동안 blocked", () => {
    const c = clock();
    const l = new ProviderRateLimiter(c.now);
    const policy = { blockCooldownMs: 10_000 };
    l.reportBlocked("p", policy);
    expect(l.tryAcquire("p", policy)).toEqual({ ok: false, reason: "blocked" });
    c.advance(10_000);
    expect(l.tryAcquire("p", policy).ok).toBe(true);
  });

  it("Provider별로 독립적으로 센다", () => {
    const l = new ProviderRateLimiter();
    const policy = { perDay: 1 };
    expect(l.tryAcquire("a", policy).ok).toBe(true);
    expect(l.tryAcquire("b", policy).ok).toBe(true);
    expect(l.tryAcquire("a", policy).ok).toBe(false);
  });
});
