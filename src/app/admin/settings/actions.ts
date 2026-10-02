"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { recipientsFor } from "@/lib/inquiry/notify";
import { getMailer } from "@/lib/mail/mailer";

/** 설정된 수신 주소로 테스트 메일 발송 */
export async function sendTestMailAction(type: "quote" | "sourcing") {
  const admin = await requireAdmin();
  const to = recipientsFor(type);
  const label = type === "quote" ? "견적 문의" : "소싱 문의";
  if (to.length === 0) redirect(`/admin/settings?error=${encodeURIComponent(`${label} 수신 주소가 설정되지 않았습니다.`)}`);
  let ok = true;
  let reason = "";
  try {
    await getMailer().send({
      to,
      subject: `[${label}] 테스트 x 1`,
      text: `알림 메일 테스트입니다. (요청: ${admin}, ${new Date().toISOString()})\n실제 문의가 아니므로 무시하세요.`,
      idempotencyKey: `test-mail/${type}/${crypto.randomUUID()}`,
    });
  } catch (err) {
    console.error("[settings] test mail failed:", err);
    ok = false;
    reason = err instanceof Error ? err.message : String(err);
  }
  const msg = ok ? `${label} 테스트 메일을 보냈습니다 → ${to.join(", ")}` : `${label} 테스트 메일 발송 실패: ${reason}`;
  redirect(`/admin/settings?${ok ? "message" : "error"}=${encodeURIComponent(msg)}`);
}
