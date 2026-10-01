/**
 * 메일 발송 어댑터 (docs/SPEC.md 6장). 트랜잭션 메일 서비스는 교체 가능하게 감싼다.
 * - console: 개발용. 실제로 보내지 않고 서버 로그에 출력
 * - TODO(확인필요): 운영 발송 서비스(AWS SES, Resend 등)와 발신 주소(도메인 인증 필요)
 */

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
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

/** MAIL_PROVIDER 로 선택. 지원하지 않는 값이면 발송 시 실패(문의 저장은 영향 없음) */
export function getMailer(): Mailer {
  const provider = (process.env.MAIL_PROVIDER ?? "console").trim().toLowerCase();
  if (provider === "console") return new ConsoleMailer();
  return {
    id: provider,
    async send() {
      throw new Error(`메일 발송 서비스가 아직 연결되지 않았습니다: MAIL_PROVIDER=${provider}`);
    },
  };
}
