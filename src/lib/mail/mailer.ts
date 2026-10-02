import { Resend } from "resend";

/**
 * 메일 발송 어댑터 (docs/SPEC.md 6장). 트랜잭션 메일 서비스는 교체 가능하게 감싼다.
 * - console: 개발용. 실제로 보내지 않고 서버 로그에 출력
 * - resend: Resend API (RESEND_API_KEY, MAIL_FROM 필요. MAIL_FROM 도메인은 Resend 에서 인증해야 함)
 */

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  /** 같은 키로 다시 보내면 서비스가 중복 발송하지 않는다 (재시도 안전) */
  idempotencyKey?: string;
}

export interface Mailer {
  readonly id: string;
  send(message: MailMessage): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  readonly id = "console";
  constructor(private readonly log: (s: string) => void = console.log) {}

  async send(m: MailMessage): Promise<void> {
    this.log(["──── [mail:console] ────", `To: ${m.to.join(", ")}`, `Subject: ${m.subject}`, "", m.text, "────────────────────────"].join("\n"));
  }
}

/** Resend SDK 중 이 어댑터가 쓰는 부분 (테스트에서 가짜로 바꿔 끼운다) */
export type ResendLike = Pick<Resend, "emails">;

export class ResendMailer implements Mailer {
  readonly id = "resend";
  private readonly client: ResendLike;

  constructor(
    apiKey: string,
    private readonly from: string,
    client?: ResendLike,
  ) {
    this.client = client ?? new Resend(apiKey);
  }

  async send(m: MailMessage): Promise<void> {
    // Resend SDK 는 API 오류에 예외를 던지지 않고 { data, error } 를 돌려주므로 error 를 직접 확인한다
    const { error } = await this.client.emails.send(
      { from: this.from, to: m.to, subject: m.subject, text: m.text },
      m.idempotencyKey ? { idempotencyKey: m.idempotencyKey } : undefined,
    );
    if (error) throw new Error(`Resend ${error.name}: ${error.message}`);
  }
}

/** 설정 오류도 발송 시점에 실패로 처리한다 (문의 저장에는 영향 없음, notify_status=failed) */
class MisconfiguredMailer implements Mailer {
  constructor(
    readonly id: string,
    private readonly reason: string,
  ) {}
  async send(): Promise<void> {
    throw new Error(this.reason);
  }
}

export function mailProvider(): string {
  return (process.env.MAIL_PROVIDER ?? "console").trim().toLowerCase();
}

/** MAIL_PROVIDER 로 선택 */
export function getMailer(): Mailer {
  const provider = mailProvider();
  if (provider === "console") return new ConsoleMailer();
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!key) return new MisconfiguredMailer("resend", "RESEND_API_KEY 가 설정되지 않았습니다.");
    if (!from) return new MisconfiguredMailer("resend", "MAIL_FROM 이 설정되지 않았습니다.");
    return new ResendMailer(key, from);
  }
  return new MisconfiguredMailer(provider, `지원하지 않는 MAIL_PROVIDER 입니다: ${provider}`);
}
