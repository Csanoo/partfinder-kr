"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { InquiryType } from "@/generated/prisma/enums";
import { ATTRIBUTION_COOKIE, decodeFirstTouch } from "@/lib/attribution";
import { recordEvent } from "@/lib/events-server";
import { sendInquiryNotification } from "@/lib/inquiry/notify-server";
import { attributionFrom, submitInquiry } from "@/lib/inquiry/submit";
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

  const jar = await cookies();
  const attribution = attributionFrom(decodeFirstTouch(jar.get(ATTRIBUTION_COOKIE)?.value));
  const res = await submitInquiry(type, formData, ip, { repo: prismaInquiryRepo, attribution });
  if (res.status === "saved") {
    // 알림은 응답 뒤에 보낸다. 실패해도 문의는 이미 저장되어 있다 (notify_status 로 표시)
    const inquiryId = res.id;
    after(() => sendInquiryNotification(inquiryId));
    await recordEvent({ type: "inquiry_submit", partId: res.partId, path: h.get("referer") ? new URL(h.get("referer")!).pathname : null }, jar);
  }
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
