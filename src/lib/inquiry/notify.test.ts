import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNotification, notifyInquiry, recipientsFor, type NotifyInquiry } from "@/lib/inquiry/notify";
import { ConsoleMailer, getMailer, ResendMailer, type Mailer, type MailMessage, type ResendLike } from "@/lib/mail/mailer";
import { submitInquiry } from "@/lib/inquiry/submit";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";

afterEach(() => vi.unstubAllEnvs());

const q: NotifyInquiry = {
  id: "8f14e45f-ceea-4e7a-9b0e-2f1c3d4e5f60",
  type: "sourcing",
  mpn: "LM358-N/NOPB",
  qty: 1500,
  dueDate: null,
  dueNegotiable: true,
  itemCountBucket: "eleven_plus",
  purchaseType: "company",
  company: "테스트 주식회사",
  contactName: "홍길동",
  createdAt: new Date("2026-10-02T01:00:00Z"),
};

describe("buildNotification", () => {
  it("부품 요청: 제목에 '외 N건', 본문에 품목 목록과 첨부 파일명", () => {
    const req: NotifyInquiry = {
      ...q,
      type: "request",
      mpn: "ULN2003A",
      qty: 500,
      items: [
        { mpn: "ULN2003A", manufacturer: "TI", qty: 500, note: "대체품 가능" },
        { mpn: "LM358N", manufacturer: null, qty: 1000, note: null },
      ],
      attachments: [{ filename: "bom.xlsx", size: 1000 }],
    };
    const { subject, text } = buildNotification(req, "https://ms.example");
    expect(subject).toBe("[부품 요청] ULN2003A x 500 외 1건");
    expect(text).toContain("품목 (2건):");
    expect(text).toContain("1. ULN2003A x 500 (TI) - 대체품 가능");
    expect(text).toContain("2. LM358N x 1,000");
    expect(text).toContain("첨부: bom.xlsx");
  });

  it("한국어가 아닌 화면에서 온 요청은 회신 언어를 표시한다", () => {
    expect(buildNotification({ ...q, locale: "en" }, "https://ms.example").text).toContain("회신 언어: 영어 (English)");
    expect(buildNotification({ ...q, locale: "ko" }, "https://ms.example").text).not.toContain("회신 언어");
  });

  it("부품 요청 수신 주소: NOTIFY_EMAIL_REQUEST, 없으면 견적 문의 주소", () => {
    vi.stubEnv("NOTIFY_EMAIL_QUOTE", "quote@ms.example");
    expect(recipientsFor("request")).toEqual(["quote@ms.example"]);
    vi.stubEnv("NOTIFY_EMAIL_REQUEST", "req@ms.example");
    expect(recipientsFor("request")).toEqual(["req@ms.example"]);
  });

  it("제목 접두어 고정: [소싱 문의] / [견적 문의]", () => {
    expect(buildNotification(q, "https://ms.example").subject).toBe("[소싱 문의] LM358-N/NOPB x 1500");
    expect(buildNotification({ ...q, type: "quote" }, "https://ms.example").subject).toBe("[견적 문의] LM358-N/NOPB x 1500");
  });

  it("본문 필수 항목과 관리자 링크", () => {
    const { text } = buildNotification(q, "https://ms.example");
    for (const s of ["문의 종류: 소싱 문의", "품번: LM358-N/NOPB", "수량: 1,500", "희망 납기: 협의", "이번 구매 품목 수: 11개 이상", "구매 용도: 회사", "회사명: 테스트 주식회사", "담당자명: 홍길동", "접수 시각:"]) {
      expect(text).toContain(s);
    }
    expect(text).toContain("관리자 화면: https://ms.example/admin/inquiries/8f14e45f-ceea-4e7a-9b0e-2f1c3d4e5f60");
  });

  it("연락처·이메일은 본문에 넣지 않는다", () => {
    const withContact = { ...q, phone: "010-1234-5678", email: "buyer@example.com" } as NotifyInquiry;
    const { subject, text } = buildNotification(withContact, "https://ms.example");
    expect(subject + text).not.toMatch(/010-1234-5678|buyer@example\.com/);
  });

  it("품번의 줄바꿈으로 메일 헤더를 주입할 수 없다", () => {
    const { subject } = buildNotification({ ...q, mpn: "X\r\nBcc: attacker@evil.example" }, "https://ms.example");
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("recipientsFor", () => {
  it("견적·소싱 각각, 없으면 공통 주소", () => {
    vi.stubEnv("NOTIFY_EMAIL_QUOTE", "quote@ms.example");
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "a@ms.example, b@ms.example");
    expect(recipientsFor("quote")).toEqual(["quote@ms.example"]);
    expect(recipientsFor("sourcing")).toEqual(["a@ms.example", "b@ms.example"]);
    vi.stubEnv("NOTIFY_EMAIL_QUOTE", "");
    vi.stubEnv("NOTIFY_EMAIL", "ops@ms.example");
    expect(recipientsFor("quote")).toEqual([]); // 빈 문자열도 '설정됨'으로 본다 → 주소 없음
  });

  it("형식이 틀린 주소는 버린다", () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "nope, ops@ms.example");
    expect(recipientsFor("sourcing")).toEqual(["ops@ms.example"]);
  });
});

describe("notifyInquiry (발송 실패해도 저장 보장)", () => {
  function deps(mailer: Mailer) {
    const setStatus = vi.fn(async () => {});
    return { mailer, setStatus, adminBaseUrl: "https://ms.example", log: vi.fn() };
  }
  const failing = (failures: number): Mailer & { send: ReturnType<typeof vi.fn> } => {
    let n = 0;
    return {
      id: "fake",
      send: vi.fn(async () => {
        if (n++ < failures) throw new Error("smtp down");
      }),
    };
  };

  it("성공하면 sent", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const m = failing(0);
    const d = deps(m);
    expect(await notifyInquiry(q, d)).toBe("sent");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: ["ops@ms.example"] }));
    expect(d.setStatus).toHaveBeenCalledWith(q.id, "sent");
  });

  it("첫 시도 실패 → 1회 재시도 성공하면 sent", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const m = failing(1);
    const d = deps(m);
    expect(await notifyInquiry(q, d)).toBe("sent");
    expect(m.send).toHaveBeenCalledTimes(2);
  });

  it("재시도까지 실패하면 failed 로 기록하고 예외를 던지지 않는다", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const m = failing(5);
    const d = deps(m);
    await expect(notifyInquiry(q, d)).resolves.toBe("failed");
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(d.setStatus).toHaveBeenCalledWith(q.id, "failed");
    expect(d.log).toHaveBeenCalled();
  });

  it("수신 주소가 없으면 보내지 않고 failed", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "");
    vi.stubEnv("NOTIFY_EMAIL", "");
    const m = failing(0);
    expect(await notifyInquiry(q, deps(m))).toBe("failed");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("상태 기록마저 실패해도 예외를 던지지 않는다", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const d = { ...deps(failing(0)), setStatus: vi.fn(async () => Promise.reject(new Error("db down"))) };
    await expect(notifyInquiry(q, d)).resolves.toBe("sent");
  });

  it("문의 저장 → 알림 실패 순서여도 저장된 문의는 그대로", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const saved: unknown[] = [];
    const repo = { create: vi.fn(async (d: unknown) => (saved.push(d), { id: q.id })) };
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      mpn: q.mpn,
      qty: "10",
      itemCountBucket: "one",
      purchaseType: "personal",
      contactName: "홍길동",
      phone: "010-0000-0000",
      email: "a@example.com",
      consentPrivacy: "on",
      consentThirdParty: "on",
    }))
      fd.set(k, v);
    const res = await submitInquiry("sourcing", fd, "1.1.1.1", { repo, limiter: new ProviderRateLimiter() });
    expect(res.status).toBe("saved");
    expect(await notifyInquiry(q, deps(failing(5)))).toBe("failed");
    expect(saved).toHaveLength(1);
  });
});

describe("getMailer", () => {
  it("기본은 console (개발용, 실제 발송 없음)", async () => {
    expect(getMailer().id).toBe("console");
    const out: string[] = [];
    await new ConsoleMailer((s) => out.push(s)).send({ to: ["ops@ms.example"], subject: "S", text: "T" });
    expect(out[0]).toContain("Subject: S");
  });

  it("지원하지 않는 서비스는 발송 시 실패 (저장에는 영향 없음)", async () => {
    vi.stubEnv("MAIL_PROVIDER", "ses");
    await expect(getMailer().send({ to: ["x@y.z"], subject: "s", text: "t" })).rejects.toThrow(/지원하지 않는/);
  });

  it("resend: 키나 발신 주소가 없으면 발송 시 실패", async () => {
    vi.stubEnv("MAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "MS유통 <noreply@ms.example>");
    await expect(getMailer().send({ to: ["x@y.z"], subject: "s", text: "t" })).rejects.toThrow(/RESEND_API_KEY/);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "");
    await expect(getMailer().send({ to: ["x@y.z"], subject: "s", text: "t" })).rejects.toThrow(/MAIL_FROM/);
    vi.stubEnv("MAIL_FROM", "MS유통 <noreply@ms.example>");
    expect(getMailer().id).toBe("resend");
  });
});

describe("ResendMailer", () => {
  function fakeResend(result: { data: unknown; error: { name: string; message: string } | null }) {
    const send = vi.fn(async () => result);
    return { client: { emails: { send } } as unknown as ResendLike, send };
  }

  it("발신 주소·수신·제목·본문과 idempotency 키를 그대로 넘긴다", async () => {
    const { client, send } = fakeResend({ data: { id: "e1" }, error: null });
    await new ResendMailer("re_test", "MS유통 <noreply@ms.example>", client).send({
      to: ["ops@ms.example"],
      subject: "[소싱 문의] X x 1",
      text: "본문",
      idempotencyKey: "inquiry-notify/abc",
    });
    expect(send).toHaveBeenCalledWith(
      { from: "MS유통 <noreply@ms.example>", to: ["ops@ms.example"], subject: "[소싱 문의] X x 1", text: "본문" },
      { idempotencyKey: "inquiry-notify/abc" },
    );
  });

  it("Resend 가 error 를 돌려주면 예외로 바꿔 재시도·실패 기록이 동작하게 한다", async () => {
    const { client } = fakeResend({ data: null, error: { name: "validation_error", message: "domain not verified" } });
    await expect(new ResendMailer("re_test", "a@b.c", client).send({ to: ["x@y.z"], subject: "s", text: "t" })).rejects.toThrow(
      "Resend validation_error: domain not verified",
    );
  });

  it("알림은 문의마다 고정 idempotency 키로 보낸다 (재시도 중복 방지)", async () => {
    vi.stubEnv("NOTIFY_EMAIL_SOURCING", "ops@ms.example");
    const sent: MailMessage[] = [];
    let n = 0;
    const mailer: Mailer = {
      id: "fake",
      async send(m) {
        sent.push(m);
        if (n++ === 0) throw new Error("timeout");
      },
    };
    await notifyInquiry(q, { mailer, setStatus: async () => {}, adminBaseUrl: "https://ms.example", log: () => {} });
    expect(sent.map((m) => m.idempotencyKey)).toEqual([`inquiry-notify/${q.id}`, `inquiry-notify/${q.id}`]);
  });
});
