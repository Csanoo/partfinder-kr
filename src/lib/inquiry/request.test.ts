import { describe, expect, it, vi } from "vitest";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { submitRequest, type InquiryRepo } from "@/lib/inquiry/submit";
import { REQUEST_LIMITS, validateRequest } from "@/lib/inquiry/validate";

function form(items: [string, string, string?, string?][], over: Record<string, string> = {}, file?: File): FormData {
  const fd = new FormData();
  for (const [mpn, qty, mfr = "", note = ""] of items) {
    fd.append("itemMpn", mpn);
    fd.append("itemQty", qty);
    fd.append("itemMfr", mfr);
    fd.append("itemNote", note);
  }
  const base = {
    purchaseType: "company",
    company: "ACME",
    contactName: "홍길동",
    phone: "02-123-4567",
    email: "a@example.com",
    consentPrivacy: "on",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  if (file) fd.set("attachment", file);
  return fd;
}

describe("validateRequest", () => {
  it("여러 품목: 빈 줄은 건너뛰고 순서대로 번호를 매긴다", () => {
    const r = validateRequest(form([[" ULN2003A ", "500", "TI", "대체품 가능"], ["", ""], ["LM358N", "1000"]]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items).toEqual([
      { position: 1, mpn: "ULN2003A", manufacturer: "TI", qty: 500, note: "대체품 가능" },
      { position: 2, mpn: "LM358N", manufacturer: null, qty: 1000, note: null },
    ]);
    // 첫 품목이 대표값, 품목 수 구간은 자동
    expect(r.data.inquiry).toMatchObject({ type: "request", mpn: "ULN2003A", qty: 500, itemCountBucket: "two_to_ten", consentThirdParty: false });
  });

  it("품목도 첨부도 없으면 오류", () => {
    const r = validateRequest(form([["", ""]]));
    expect(r).toMatchObject({ ok: false, spam: false, errors: { items: expect.any(String) } });
  });

  it("품번만 있고 수량이 없는 줄은 해당 줄 오류", () => {
    const r = validateRequest(form([["ULN2003A", "500"], ["LM358N", ""]]));
    expect(r).toMatchObject({ ok: false, errors: { item1: expect.stringContaining("수량") } });
  });

  it("첨부만 있어도 접수된다 (대표 품번은 파일명)", () => {
    const file = new File(["mpn,qty\nA,1"], "bom.csv", { type: "text/csv" });
    const r = validateRequest(form([], {}, file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items).toEqual([]);
    expect(r.data.attachment).toMatchObject({ filename: "bom.csv", contentType: "text/csv" });
    expect(r.data.inquiry).toMatchObject({ mpn: "[첨부] bom.csv", qty: 0, itemCountBucket: "two_to_ten" });
  });

  it("허용하지 않는 확장자·용량 초과 첨부는 거부", () => {
    const exe = validateRequest(form([["A", "1"]], {}, new File(["x"], "virus.exe")));
    expect(exe).toMatchObject({ ok: false, errors: { attachment: expect.any(String) } });
    const big = new File([new Uint8Array(REQUEST_LIMITS.maxFileBytes + 1)], "big.pdf");
    expect(validateRequest(form([["A", "1"]], {}, big))).toMatchObject({ ok: false, errors: { attachment: expect.stringContaining("5MB") } });
  });

  it("파일명의 경로 구분자·제어 문자는 바꾼다", () => {
    const r = validateRequest(form([["A", "1"]], {}, new File(["x"], "..\\..\\evil\u0000.csv")));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.attachment?.filename).not.toMatch(/[\\/\u0000]/);
  });

  it("제3자 제공 동의는 선택, 개인정보 수집 동의는 필수", () => {
    expect(validateRequest(form([["A", "1"]], { consentThirdParty: "on" }))).toMatchObject({ ok: true, data: { inquiry: { consentThirdParty: true } } });
    const fd = form([["A", "1"]]);
    fd.delete("consentPrivacy");
    expect(validateRequest(fd)).toMatchObject({ ok: false, errors: { consentPrivacy: expect.any(String) } });
  });

  it("11개 이상이면 eleven_plus, 한도 초과는 오류", () => {
    const many = Array.from({ length: 11 }, (_, i) => [`P${i}`, "1"] as [string, string]);
    expect(validateRequest(form(many))).toMatchObject({ ok: true, data: { inquiry: { itemCountBucket: "eleven_plus" } } });
    const tooMany = Array.from({ length: REQUEST_LIMITS.maxItems + 1 }, (_, i) => [`P${i}`, "1"] as [string, string]);
    expect(validateRequest(form(tooMany))).toMatchObject({ ok: false, errors: { items: expect.any(String) } });
  });

  it("honeypot 이 채워지면 spam", () => {
    expect(validateRequest(form([["A", "1"]], { website: "x" }))).toEqual({ ok: false, spam: true });
  });
});

describe("submitRequest", () => {
  it("품목·첨부 바이트를 함께 저장한다", async () => {
    const create = vi.fn(async () => ({ id: "id-1" }));
    const repo: InquiryRepo = { create };
    const file = new File(["hello"], "bom.txt");
    const res = await submitRequest(form([["ULN2003A", "500"]], {}, file), "1.1.1.1", { repo, limiter: new ProviderRateLimiter() });
    expect(res).toEqual({ status: "saved", id: "id-1", partId: null });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "request", mpn: "ULN2003A", consentTextVersion: expect.any(String) }),
      {
        items: [{ position: 1, mpn: "ULN2003A", manufacturer: null, qty: 500, note: null }],
        attachment: { filename: "bom.txt", contentType: "text/plain", size: 5, data: new TextEncoder().encode("hello") },
      },
    );
  });
});
