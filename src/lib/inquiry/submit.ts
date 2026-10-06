import type { InquiryType } from "@/generated/prisma/enums";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import { consentTexts } from "@/lib/inquiry/consent";
import type { FirstTouch } from "@/lib/attribution";
import { validateInquiry, validateRequest, type FieldErrors, type InquiryInput, type RequestItemInput } from "@/lib/inquiry/validate";

/** 문의에 함께 저장하는 유입 정보 (SEO_SPEC 8장) */
export interface InquiryAttribution {
  landingUrl: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstVisitAt: Date | null;
  trafficSource: string | null;
}

export function attributionFrom(touch: FirstTouch | null): InquiryAttribution {
  return {
    landingUrl: touch?.landingUrl ?? null,
    referrer: touch?.referrer ?? null,
    utmSource: touch?.utmSource ?? null,
    utmMedium: touch?.utmMedium ?? null,
    utmCampaign: touch?.utmCampaign ?? null,
    firstVisitAt: touch ? new Date(touch.firstVisitAt) : null,
    trafficSource: touch?.trafficSource ?? null,
  };
}

export interface StoredAttachment {
  filename: string;
  contentType: string;
  size: number;
  data: Uint8Array;
}

export interface InquiryRepo {
  create(
    data: InquiryInput & InquiryAttribution & { consentTextVersion: string; locale?: string },
    extra?: { items: RequestItemInput[]; attachment: StoredAttachment | null },
  ): Promise<{ id: string }>;
}

export type SubmitResult =
  | { status: "saved"; id: string; partId: string | null }
  /** honeypot에 걸린 경우: 저장하지 않지만 봇에게는 성공처럼 보이게 한다 */
  | { status: "spam" }
  | { status: "rate_limited" }
  | { status: "invalid"; errors: FieldErrors };

/** IP 기준 문의 제한. TODO(확인필요): 한도 값 */
export const INQUIRY_RATE_POLICY = { perMinute: 3, perDay: 20 };

const g = globalThis as unknown as { __inquiryLimiter?: ProviderRateLimiter };
const defaultLimiter = (g.__inquiryLimiter ??= new ProviderRateLimiter());

export async function submitInquiry(
  type: InquiryType,
  form: FormData,
  ip: string,
  deps: { repo: InquiryRepo; limiter?: ProviderRateLimiter; attribution?: InquiryAttribution },
): Promise<SubmitResult> {
  const result = validateInquiry(type, form);
  if (!result.ok && result.spam) return { status: "spam" };

  const limiter = deps.limiter ?? defaultLimiter;
  if (!limiter.tryAcquire(`inquiry:${ip}`, INQUIRY_RATE_POLICY).ok) return { status: "rate_limited" };

  if (!result.ok) return { status: "invalid", errors: result.errors };

  const saved = await deps.repo.create({
    ...result.data,
    ...(deps.attribution ?? attributionFrom(null)),
    consentTextVersion: consentTexts().version,
  });
  return { status: "saved", id: saved.id, partId: result.data.partId };
}

/** 부품 요청 접수 (여러 품목 + 선택 첨부). 흐름은 submitInquiry 와 같다 */
export async function submitRequest(
  form: FormData,
  ip: string,
  deps: { repo: InquiryRepo; limiter?: ProviderRateLimiter; attribution?: InquiryAttribution; messages?: Dict["errors"]; locale?: Locale },
): Promise<SubmitResult> {
  const result = validateRequest(form, deps.messages);
  if (!result.ok && result.spam) return { status: "spam" };

  const limiter = deps.limiter ?? defaultLimiter;
  if (!limiter.tryAcquire(`inquiry:${ip}`, INQUIRY_RATE_POLICY).ok) return { status: "rate_limited" };

  if (!result.ok) return { status: "invalid", errors: result.errors };

  const { inquiry, items, attachment } = result.data;
  const stored: StoredAttachment | null = attachment
    ? { filename: attachment.filename, contentType: attachment.contentType, size: attachment.file.size, data: new Uint8Array(await attachment.file.arrayBuffer()) }
    : null;
  const saved = await deps.repo.create(
    { ...inquiry, ...(deps.attribution ?? attributionFrom(null)), consentTextVersion: consentTexts().version, locale: deps.locale ?? "ko" },
    { items, attachment: stored },
  );
  return { status: "saved", id: saved.id, partId: inquiry.partId };
}
