import type { InquiryType } from "@/generated/prisma/enums";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { consentTexts } from "@/lib/inquiry/consent";
import { validateInquiry, type FieldErrors, type InquiryInput } from "@/lib/inquiry/validate";

export interface InquiryRepo {
  create(data: InquiryInput & { consentTextVersion: string }): Promise<{ id: string }>;
}

export type SubmitResult =
  | { status: "saved"; id: string }
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
  deps: { repo: InquiryRepo; limiter?: ProviderRateLimiter },
): Promise<SubmitResult> {
  const result = validateInquiry(type, form);
  if (!result.ok && result.spam) return { status: "spam" };

  const limiter = deps.limiter ?? defaultLimiter;
  if (!limiter.tryAcquire(`inquiry:${ip}`, INQUIRY_RATE_POLICY).ok) return { status: "rate_limited" };

  if (!result.ok) return { status: "invalid", errors: result.errors };

  const saved = await deps.repo.create({ ...result.data, consentTextVersion: consentTexts().version });
  return { status: "saved", id: saved.id };
}
