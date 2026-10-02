import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronJob, verifyCronSecret } from "@/lib/cron-jobs";

afterEach(() => vi.unstubAllEnvs());

describe("cron 작업 인증", () => {
  it("CRON_SECRET 이 없거나 짧으면 항상 거부", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret("Bearer ")).toBe(false);
    vi.stubEnv("CRON_SECRET", "short");
    expect(verifyCronSecret("Bearer short")).toBe(false);
  });

  it("정확히 일치할 때만 통과", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-0123456789abcdef");
    expect(verifyCronSecret("Bearer s3cret-0123456789abcdef")).toBe(true);
    expect(verifyCronSecret("Bearer s3cret-0123456789abcdeX")).toBe(false);
    expect(verifyCronSecret("s3cret-0123456789abcdef")).toBe(false);
    expect(verifyCronSecret(null)).toBe(false);
  });

  it("정해진 작업 이름만", () => {
    expect(isCronJob("recompute-indexable")).toBe(true);
    expect(isCronJob("purge-personal-data")).toBe(true);
    expect(isCronJob("manufacturer-facts")).toBe(true);
    expect(isCronJob("toString")).toBe(false);
    expect(isCronJob("drop-tables")).toBe(false);
  });
});
