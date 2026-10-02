import { sendTestMailAction } from "@/app/admin/settings/actions";
import { btnSecondary, Card, first, Notice } from "@/components/admin/ui";
import { recipientsFor } from "@/lib/inquiry/notify";
import { retentionDays } from "@/lib/inquiry/retention";
import { getMailer, mailProvider } from "@/lib/mail/mailer";
import { site } from "@/lib/site";

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-start gap-2">
      <span className={`mt-1 size-2 shrink-0 rounded-full ${ok ? "bg-pcb-500" : "bg-copper-500"}`} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/**
 * 설정 현황 (읽기 전용). 값은 서버 환경변수(.env)에서 바꾼다 — 비밀값을 DB·화면에서 편집하지 않기 위함.
 * TODO(확인필요): 수신 주소를 관리자 화면에서 바꿀 필요가 생기면 설정 테이블로 이동
 */
export default async function SettingsPage(props: PageProps<"/admin/settings">) {
  const sp = await props.searchParams;
  const mailer = getMailer();
  const quote = recipientsFor("quote");
  const sourcing = recipientsFor("sourcing");
  const retention = retentionDays();

  const env = (k: string) => <code className="mpn rounded bg-background px-1 text-xs">{k}</code>;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">설정</h1>
      <Notice error={first(sp.error)} message={first(sp.message)} />

      <Card title="문의 알림 메일">
        <div className="space-y-3 text-sm">
          <Status ok={mailer.id !== "console"}>
            발송 방식: <b>{mailer.id === "console" ? "콘솔 출력 (개발용, 실제 발송 없음)" : mailer.id === "resend" ? "Resend" : mailer.id}</b> — {env("MAIL_PROVIDER")}
          </Status>
          {mailProvider() === "resend" && (
            <>
              <Status ok={!!process.env.RESEND_API_KEY?.trim()}>
                Resend API 키: <b>{process.env.RESEND_API_KEY?.trim() ? "설정됨" : "미설정"}</b> — {env("RESEND_API_KEY")}
              </Status>
              <Status ok={!!process.env.MAIL_FROM?.trim()}>
                발신 주소: <b>{process.env.MAIL_FROM?.trim() || "미설정"}</b> — {env("MAIL_FROM")} (Resend 에서 도메인 인증 필요)
              </Status>
            </>
          )}
          <Status ok={quote.length > 0}>
            견적 문의 수신: <b>{quote.join(", ") || "미설정"}</b> — {env("NOTIFY_EMAIL_QUOTE")}
          </Status>
          <Status ok={sourcing.length > 0}>
            소싱 문의 수신: <b>{sourcing.join(", ") || "미설정"}</b> — {env("NOTIFY_EMAIL_SOURCING")}
          </Status>
          <p className="text-xs text-muted">
            두 값이 없으면 {env("NOTIFY_EMAIL")} 를 공통으로 씁니다. 여러 주소는 쉼표로 구분합니다. 수신자는 운영자로 한정하며 브로커 등 제3자에게 자동 발송하지 않습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={sendTestMailAction.bind(null, "quote")}>
              <button className={btnSecondary}>견적 문의 테스트 메일</button>
            </form>
            <form action={sendTestMailAction.bind(null, "sourcing")}>
              <button className={btnSecondary}>소싱 문의 테스트 메일</button>
            </form>
          </div>
          {mailer.id === "console" && <p className="text-xs text-muted">콘솔 모드에서는 메일 내용이 서버 로그(개발 서버 터미널)에 출력됩니다.</p>}
        </div>
      </Card>

      <Card title="기타">
        <div className="space-y-2 text-sm">
          <Status ok={!site.url.includes("localhost")}>
            사이트 주소: <b>{site.url}</b> — {env("SITE_URL")} (메일의 관리자 링크·사이트맵에 쓰임)
          </Status>
          <Status ok={retention != null}>
            개인정보 보유기간: <b>{retention != null ? `${retention}일` : "미설정 (파기 작업이 아무것도 지우지 않음)"}</b> — {env("PERSONAL_DATA_RETENTION_DAYS")}
          </Status>
          <Status ok={!!process.env.GOOGLE_SITE_VERIFICATION}>구글 Search Console 확인 태그 — {env("GOOGLE_SITE_VERIFICATION")}</Status>
          <Status ok={!!process.env.NAVER_SITE_VERIFICATION}>네이버 서치어드바이저 확인 태그 — {env("NAVER_SITE_VERIFICATION")}</Status>
        </div>
      </Card>

      <p className="text-xs text-muted">값을 바꾼 뒤에는 서버를 다시 시작해야 반영됩니다.</p>
    </div>
  );
}
