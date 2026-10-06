import { db } from "@/lib/db";
import { notifyInquiry } from "@/lib/inquiry/notify";
import { getMailer } from "@/lib/mail/mailer";
import { site } from "@/lib/site";

/** DB 에서 문의를 읽어 알림 발송 + notify_status 기록 (접수 직후 after() 로, 관리자 재발송에서 호출) */
export async function sendInquiryNotification(inquiryId: string): Promise<"sent" | "failed"> {
  const q = await db().inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      type: true,
      mpn: true,
      qty: true,
      dueDate: true,
      dueNegotiable: true,
      itemCountBucket: true,
      purchaseType: true,
      company: true,
      contactName: true,
      createdAt: true,
      items: { select: { mpn: true, manufacturer: true, qty: true, note: true }, orderBy: { position: "asc" } },
      attachments: { select: { filename: true, size: true } },
    },
  });
  if (!q) return "failed";
  return notifyInquiry(q, {
    mailer: getMailer(),
    adminBaseUrl: site.url,
    setStatus: async (id, status) => {
      await db().inquiry.update({ where: { id }, data: { notifyStatus: status } });
    },
  });
}
