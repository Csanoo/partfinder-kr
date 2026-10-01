import { describe, expect, it } from "vitest";
import { validateInquiry } from "@/lib/inquiry/validate";

function form(over: Record<string, string | undefined> = {}): FormData {
  const base: Record<string, string | undefined> = {
    mpn: " ULN2003A ",
    qty: "100",
    dueDate: "",
    itemCountBucket: "two_to_ten",
    purchaseType: "company",
    company: "테스트 주식회사",
    contactName: "홍길동",
    phone: "010-1234-5678",
    email: "buyer@example.com",
    memo: "",
    consentPrivacy: "on",
    ...over,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) if (v !== undefined) fd.set(k, v);
  return fd;
}

describe("validateInquiry", () => {
  it("정상 입력 (견적)", () => {
    const r = validateInquiry("quote", form());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      type: "quote",
      mpn: "ULN2003A",
      qty: 100,
      purchaseType: "company",
      company: "테스트 주식회사",
      consentPrivacy: true,
      consentThirdParty: null,
      dueDate: null,
      memo: null,
    });
  });

  it("honeypot이 채워지면 spam", () => {
    expect(validateInquiry("quote", form({ website: "http://spam" }))).toEqual({ ok: false, spam: true });
  });

  it("필수 항목 누락", () => {
    const r = validateInquiry("quote", form({ mpn: "", qty: "", contactName: "", phone: "", email: "", consentPrivacy: undefined }));
    expect(r.ok).toBe(false);
    if (r.ok || r.spam) return;
    expect(Object.keys(r.errors).sort()).toEqual(["consentPrivacy", "contactName", "email", "mpn", "phone", "qty"]);
  });

  it.each(["0", "-1", "1.5", "abc", "99999999999999999999"])("잘못된 수량 %s", (qty) => {
    const r = validateInquiry("quote", form({ qty }));
    expect(r.ok === false && !r.spam && r.errors.qty).toBeTruthy();
  });

  it("구매 용도=회사면 회사명 필수, 개인이면 선택", () => {
    const company = validateInquiry("quote", form({ company: "" }));
    expect(company.ok === false && !company.spam && company.errors.company).toBeTruthy();
    const personal = validateInquiry("quote", form({ purchaseType: "personal", company: "" }));
    expect(personal.ok).toBe(true);
    if (personal.ok) expect(personal.data.company).toBeNull();
  });

  it("품목 수·구매 용도는 정해진 값만", () => {
    const r = validateInquiry("quote", form({ itemCountBucket: "many", purchaseType: "gov" }));
    expect(r.ok === false && !r.spam && Object.keys(r.errors)).toEqual(["itemCountBucket", "purchaseType"]);
  });

  it("소싱 문의는 제3자 제공 동의 필수", () => {
    const no = validateInquiry("sourcing", form());
    expect(no.ok === false && !no.spam && no.errors.consentThirdParty).toBeTruthy();
    const yes = validateInquiry("sourcing", form({ consentThirdParty: "on" }));
    expect(yes.ok && yes.data.consentThirdParty).toBe(true);
  });

  it("견적 문의는 제3자 동의 값이 와도 null로 저장", () => {
    const r = validateInquiry("quote", form({ consentThirdParty: "on" }));
    expect(r.ok && r.data.consentThirdParty).toBeNull();
  });

  it("희망 납기: 날짜 또는 협의", () => {
    const date = validateInquiry("quote", form({ dueDate: "2026-11-30", dueNegotiable: "on" }));
    expect(date.ok && date.data.dueDate?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(date.ok && date.data.dueNegotiable).toBe(false);
    const nego = validateInquiry("quote", form({ dueNegotiable: "on" }));
    expect(nego.ok && nego.data.dueNegotiable).toBe(true);
    const bad = validateInquiry("quote", form({ dueDate: "2026/11/30" }));
    expect(bad.ok === false && !bad.spam && bad.errors.dueDate).toBeTruthy();
  });

  it("연락처·이메일 형식", () => {
    const r = validateInquiry("quote", form({ phone: "abc", email: "no-at" }));
    expect(r.ok === false && !r.spam && Object.keys(r.errors).sort()).toEqual(["email", "phone"]);
  });

  it("searchLogId는 UUID만 받는다", () => {
    const good = validateInquiry("quote", form({ searchLogId: "8f14e45f-ceea-4e7a-9b0e-2f1c3d4e5f60" }));
    expect(good.ok && good.data.searchLogId).toBe("8f14e45f-ceea-4e7a-9b0e-2f1c3d4e5f60");
    const bad = validateInquiry("quote", form({ searchLogId: "1; DROP TABLE" }));
    expect(bad.ok && bad.data.searchLogId).toBeNull();
  });
});
