import { describe, expect, it, vi } from "vitest";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { submitInquiry, type InquiryRepo } from "@/lib/inquiry/submit";

function validForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base = {
    mpn: "ULN2003A",
    qty: "10",
    itemCountBucket: "eleven_plus",
    purchaseType: "company",
    company: "ACME",
    contactName: "홍길동",
    phone: "02-123-4567",
    email: "a@example.com",
    consentPrivacy: "on",
    consentThirdParty: "on",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

function repo(): InquiryRepo & { create: ReturnType<typeof vi.fn> } {
  return { create: vi.fn(async () => ({ id: "id-1" })) };
}

describe("submitInquiry", () => {
  it("정상 입력은 동의 문구 버전과 함께 저장한다", async () => {
    const r = repo();
    const res = await submitInquiry("sourcing", validForm(), "1.1.1.1", { repo: r, limiter: new ProviderRateLimiter() });
    expect(res).toEqual({ status: "saved", id: "id-1" });
    expect(r.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "sourcing", consentThirdParty: true, consentTextVersion: expect.any(String) }),
    );
  });

  it("honeypot에 걸리면 저장하지 않는다", async () => {
    const r = repo();
    const res = await submitInquiry("quote", validForm({ website: "x" }), "1.1.1.1", { repo: r, limiter: new ProviderRateLimiter() });
    expect(res).toEqual({ status: "spam" });
    expect(r.create).not.toHaveBeenCalled();
  });

  it("검증 실패는 저장하지 않고 오류를 돌려준다", async () => {
    const r = repo();
    const res = await submitInquiry("quote", validForm({ email: "" }), "1.1.1.1", { repo: r, limiter: new ProviderRateLimiter() });
    expect(res.status).toBe("invalid");
    expect(r.create).not.toHaveBeenCalled();
  });

  it("같은 IP에서 분당 한도를 넘으면 rate_limited, 다른 IP는 영향 없음", async () => {
    const r = repo();
    const limiter = new ProviderRateLimiter();
    for (let i = 0; i < 3; i++) {
      expect((await submitInquiry("quote", validForm(), "2.2.2.2", { repo: r, limiter })).status).toBe("saved");
    }
    expect((await submitInquiry("quote", validForm(), "2.2.2.2", { repo: r, limiter })).status).toBe("rate_limited");
    expect((await submitInquiry("quote", validForm(), "3.3.3.3", { repo: r, limiter })).status).toBe("saved");
  });
});
