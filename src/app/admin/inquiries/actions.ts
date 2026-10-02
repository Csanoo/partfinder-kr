"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendInquiryNotification } from "@/lib/inquiry/notify-server";
import { buildFaqCandidate } from "@/lib/inquiry/to-faq";
import { mpnKey } from "@/lib/parts/slug";

const STATUSES: InquiryStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export async function setInquiryStatusAction(id: string, fd: FormData) {
  await requireAdmin();
  const status = fd.get("status");
  if (typeof status !== "string" || !STATUSES.includes(status as InquiryStatus)) return;
  await db().inquiry.update({ where: { id }, data: { status: status as InquiryStatus } });
  revalidatePath("/admin/inquiries");
  revalidatePath(`/admin/inquiries/${id}`);
  revalidatePath("/admin");
}

/** 알림 메일 다시 보내기 (발송 실패 건) */
export async function resendNotificationAction(id: string) {
  await requireAdmin();
  await sendInquiryNotification(id);
  revalidatePath(`/admin/inquiries/${id}`);
  revalidatePath("/admin/inquiries");
  revalidatePath("/admin");
}
/**
 * 문의를 FAQ 후보로 보내기 (SEO_SPEC 7장).
 * 부품 페이지에서 온 문의는 그 부품에, 아니면 같은 품번(mpnKey)의 부품이 하나뿐일 때 그 부품에 만든다.
 * 개인정보를 지운 질문 초안 + 답변 자리표시, 미게시. 같은 문의로 두 번 만들지 않는다.
 */
export async function inquiryToFaqAction(inquiryId: string) {
  await requireAdmin();
  const q = await db().inquiry.findUniqueOrThrow({
    where: { id: inquiryId },
    select: { mpn: true, qty: true, type: true, memo: true, contactName: true, company: true, partId: true },
  });
  const fail = (msg: string): never => redirect(`/admin/inquiries/${inquiryId}?error=${encodeURIComponent(msg)}`);

  let partId = q.partId;
  if (!partId) {
    const matches = await db().part.findMany({ where: { mpnKey: mpnKey(q.mpn) }, select: { id: true }, take: 2 });
    if (matches.length === 0) fail("이 품번의 부품 페이지가 없습니다. 부품을 먼저 등록해 주세요.");
    if (matches.length > 1) fail("같은 품번의 부품이 여러 제조사에 있습니다. 해당 부품 편집 화면에서 직접 추가해 주세요.");
    partId = matches[0].id;
  }
  const existing = await db().partFaq.findFirst({ where: { sourceInquiryId: inquiryId }, select: { id: true } });
  if (!existing) {
    await db().partFaq.create({
      data: { partId: partId!, ...buildFaqCandidate(q), source: "inquiry", published: false, sourceInquiryId: inquiryId },
    });
  }
  redirect(`/admin/parts/${partId}?message=${encodeURIComponent(existing ? "이미 FAQ 후보로 보낸 문의입니다." : "FAQ 후보를 만들었습니다. 질문을 다듬고 답변을 쓴 뒤 게시하세요.")}#faq`);
}