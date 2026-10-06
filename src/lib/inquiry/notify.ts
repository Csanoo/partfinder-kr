import type { Mailer, MailMessage } from "@/lib/mail/mailer";

/**
 * 문의 접수 알림 (docs/SPEC.md 6장)
 * - 수신자는 운영자로 한정 (견적·소싱 각각 환경변수). 외부 업체 등 제3자에게 자동 발송하지 않는다.
 * - 본문에 연락처·이메일을 넣지 않는다 (관리자 화면에서만 확인).
 * - 발송 실패해도 문의 저장에는 영향 없음. 1회 재시도, 결과를 notify_status 에 기록.
 */

export interface NotifyInquiry {
  id: string;
  type: "quote" | "sourcing" | "request";
  mpn: string;
  qty: number;
  dueDate: Date | null;
  dueNegotiable: boolean;
  itemCountBucket: "one" | "two_to_ten" | "eleven_plus";
  purchaseType: "company" | "personal";
  company: string | null;
  contactName: string | null;
  createdAt: Date;
  /** 부품 요청 품목 (요청 종류만) */
  items?: { mpn: string; manufacturer: string | null; qty: number; note: string | null }[];
  /** 접수 화면 언어 (ko 외에는 메일에 표시: 회신 언어) */
  locale?: string;
  /** 첨부 파일명 (요청 종류만) */
  attachments?: { filename: string; size: number }[];
}

const TYPE_LABEL = { quote: "견적 문의", sourcing: "소싱 문의", request: "부품 요청" } as const;
const MAIL_ITEM_LIMIT = 30;
const BUCKET_LABEL = { one: "1개", two_to_ten: "2~10개", eleven_plus: "11개 이상" } as const;
const PURCHASE_LABEL = { company: "회사", personal: "개인" } as const;

/** 메일 헤더 주입 방지: 줄바꿈·제어 문자 제거 */
const oneLine = (s: string) => s.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").trim();

export function recipientsFor(type: NotifyInquiry["type"]): string[] {
  // 부품 요청은 NOTIFY_EMAIL_REQUEST, 없으면 견적 문의 수신 주소로 보낸다
  const raw =
    (type === "quote"
      ? process.env.NOTIFY_EMAIL_QUOTE
      : type === "sourcing"
        ? process.env.NOTIFY_EMAIL_SOURCING
        : process.env.NOTIFY_EMAIL_REQUEST || process.env.NOTIFY_EMAIL_QUOTE) ??
    process.env.NOTIFY_EMAIL ??
    "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(s));
}

export function buildNotification(q: NotifyInquiry, adminBaseUrl: string): Omit<MailMessage, "to"> {
  // 제목 접두어는 메일함 필터용으로 고정
  const more = q.items && q.items.length > 1 ? ` 외 ${q.items.length - 1}건` : "";
  const subject = oneLine(`[${TYPE_LABEL[q.type]}] ${q.mpn}${q.qty > 0 ? ` x ${q.qty}` : ""}${more}`).slice(0, 200);
  const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(q.createdAt);
  const due = q.dueDate ? q.dueDate.toISOString().slice(0, 10) : q.dueNegotiable ? "협의" : "-";
  const itemLines =
    q.items && q.items.length > 0
      ? [
          `품목 (${q.items.length}건):`,
          ...q.items
            .slice(0, MAIL_ITEM_LIMIT)
            .map(
              (it, i) =>
                `  ${i + 1}. ${oneLine(it.mpn)} x ${it.qty.toLocaleString("ko-KR")}${it.manufacturer ? ` (${oneLine(it.manufacturer)})` : ""}${it.note ? ` - ${oneLine(it.note)}` : ""}`,
            ),
          ...(q.items.length > MAIL_ITEM_LIMIT ? [`  … 나머지 ${q.items.length - MAIL_ITEM_LIMIT}건은 관리자 화면에서 확인`] : []),
        ]
      : [`품번: ${oneLine(q.mpn)}`, `수량: ${q.qty.toLocaleString("ko-KR")}`];
  const fileLines = q.attachments && q.attachments.length > 0 ? [`첨부: ${q.attachments.map((a) => oneLine(a.filename)).join(", ")}`] : [];
  const LANG: Record<string, string> = { en: "영어 (English)", ja: "일본어 (日本語)", es: "스페인어 (Español)" };
  const lines = [
    `문의 종류: ${TYPE_LABEL[q.type]}`,
    ...(q.locale && LANG[q.locale] ? [`회신 언어: ${LANG[q.locale]}`] : []),
    ...itemLines,
    ...fileLines,
    `희망 납기: ${due}`,
    `이번 구매 품목 수: ${BUCKET_LABEL[q.itemCountBucket]}`,
    `구매 용도: ${PURCHASE_LABEL[q.purchaseType]}`,
    `회사명: ${q.company ? oneLine(q.company) : "-"}`,
    `담당자명: ${q.contactName ? oneLine(q.contactName) : "-"}`,
    `접수 시각: ${kst}`,
    "",
    `관리자 화면: ${new URL(`/admin/inquiries/${q.id}`, adminBaseUrl).toString()}`,
    "(연락처·이메일은 관리자 화면에서 확인하세요)",
  ];
  return { subject, text: lines.join("\n") };
}

export interface NotifyDeps {
  mailer: Mailer;
  setStatus(id: string, status: "sent" | "failed"): Promise<void>;
  adminBaseUrl: string;
  log?: (msg: string, err?: unknown) => void;
}

/** 발송 + 1회 재시도. 절대 예외를 던지지 않는다 (호출 측의 문의 저장을 보호) */
export async function notifyInquiry(q: NotifyInquiry, deps: NotifyDeps): Promise<"sent" | "failed"> {
  const log = deps.log ?? ((m, e) => console.error(m, e ?? ""));
  let status: "sent" | "failed" = "failed";
  const to = recipientsFor(q.type);
  if (to.length === 0) {
    log(`[notify] ${q.id}: 수신 주소 미설정 (NOTIFY_EMAIL_${q.type.toUpperCase()})`);
  } else {
    // 문의마다 고정 키: 재시도·재발송이 겹쳐도 같은 메일이 두 번 가지 않는다 (Resend 기준 24시간)
    const message = { to, ...buildNotification(q, deps.adminBaseUrl), idempotencyKey: `inquiry-notify/${q.id}` };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await deps.mailer.send(message);
        status = "sent";
        break;
      } catch (err) {
        log(`[notify] ${q.id}: 발송 실패 (${attempt}/2, ${deps.mailer.id})`, err);
      }
    }
  }
  try {
    await deps.setStatus(q.id, status);
  } catch (err) {
    log(`[notify] ${q.id}: 상태 기록 실패`, err);
  }
  return status;
}
