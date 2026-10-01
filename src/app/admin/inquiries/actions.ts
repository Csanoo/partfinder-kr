"use server";

import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

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
