"use server";

import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendInquiryNotification } from "@/lib/inquiry/notify-server";

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