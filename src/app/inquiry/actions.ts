"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { InquiryType } from "@/generated/prisma/enums";
import { submitInquiry } from "@/lib/inquiry/submit";
import type { FieldErrors } from "@/lib/inquiry/validate";
import { prismaInquiryRepo } from "@/lib/repos";

export interface InquiryFormState {
  errors?: FieldErrors;
  message?: string;
  /** 오류 시 입력값 유지용 */
  values?: Record<string, string>;
}

async function handle(type: InquiryType, formData: FormData): Promise<InquiryFormState> {
  const h = await headers();
  // TODO(확인필요): 배포 환경의 프록시 구성에 맞춰 신뢰할 IP 헤더 확정
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  const res = await submitInquiry(type, formData, ip, { repo: prismaInquiryRepo });
  if (res.status === "saved" || res.status === "spam") redirect(`/inquiry/thanks?type=${type}`);

  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;

  if (res.status === "rate_limited") {
    return { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", values };
  }
  return { errors: res.errors, message: "입력 내용을 확인해 주세요.", values };
}

export async function submitQuoteInquiry(_prev: InquiryFormState, formData: FormData) {
  return handle("quote", formData);
}

export async function submitSourcingInquiry(_prev: InquiryFormState, formData: FormData) {
  return handle("sourcing", formData);
}
