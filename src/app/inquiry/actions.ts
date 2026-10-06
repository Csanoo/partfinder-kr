"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { InquiryType } from "@/generated/prisma/enums";
import { ATTRIBUTION_COOKIE, decodeFirstTouch } from "@/lib/attribution";
import { recordEvent } from "@/lib/events-server";
import { sendInquiryNotification } from "@/lib/inquiry/notify-server";
import { attributionFrom, submitInquiry, submitRequest } from "@/lib/inquiry/submit";
import type { FieldErrors } from "@/lib/inquiry/validate";
import { prismaInquiryRepo } from "@/lib/repos";

export interface InquiryFormState {
  errors?: FieldErrors;
  message?: string;
  /** 오류 시 입력값 유지용 */
  values?: Record<string, string>;
  /** 부품 요청: 품목 줄 입력값 유지용 */
  items?: { mpn: string; qty: string; mfr: string; note: string }[];
}

const str = (v: FormDataEntryValue | undefined) => (typeof v === "string" ? v : "");

async function handle(type: InquiryType, formData: FormData): Promise<InquiryFormState> {
  const h = await headers();
  // 배포: 같은 서버의 Caddy 가 X-Forwarded-For 를 클라이언트 IP 로 설정한다 (외부에서 보낸 값은 신뢰하지 않음, deploy/Caddyfile)
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  const jar = await cookies();
  const attribution = attributionFrom(decodeFirstTouch(jar.get(ATTRIBUTION_COOKIE)?.value));
  const deps = { repo: prismaInquiryRepo, attribution };
  const res = type === "request" ? await submitRequest(formData, ip, deps) : await submitInquiry(type, formData, ip, deps);
  if (res.status === "saved") {
    // 알림은 응답 뒤에 보낸다. 실패해도 문의는 이미 저장되어 있다 (notify_status 로 표시)
    const inquiryId = res.id;
    after(() => sendInquiryNotification(inquiryId));
    await recordEvent({ type: "inquiry_submit", partId: res.partId, path: h.get("referer") ? new URL(h.get("referer")!).pathname : null }, jar);
  }
  if (res.status === "saved" || res.status === "spam") redirect(`/inquiry/thanks?type=${type}`);

  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$") && !k.startsWith("item")) values[k] = v;

  // 품목 줄은 순서대로 배열로 돌려준다 (오류 후 다시 그리기용)
  const items = formData.getAll("itemMpn").map((_, i) => ({
    mpn: str(formData.getAll("itemMpn")[i]),
    qty: str(formData.getAll("itemQty")[i]),
    mfr: str(formData.getAll("itemMfr")[i]),
    note: str(formData.getAll("itemNote")[i]),
  }));

  if (res.status === "rate_limited") {
    return { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", values, items };
  }
  const fileNote = formData.get("attachment") instanceof File && (formData.get("attachment") as File).size > 0 ? " 첨부 파일은 다시 선택해 주세요." : "";
  return { errors: res.errors, message: `입력 내용을 확인해 주세요.${fileNote}`, values, items };
}

export async function submitPartRequest(_prev: InquiryFormState, formData: FormData) {
  return handle("request", formData);
}
