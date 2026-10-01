import type { InquiryType, ItemCountBucket, PurchaseType } from "@/generated/prisma/enums";

export const HONEYPOT_FIELD = "website";

export interface InquiryInput {
  type: InquiryType;
  mpn: string;
  qty: number;
  dueDate: Date | null;
  dueNegotiable: boolean;
  itemCountBucket: ItemCountBucket;
  purchaseType: PurchaseType;
  company: string | null;
  contactName: string;
  phone: string;
  email: string;
  memo: string | null;
  consentPrivacy: true;
  consentThirdParty: boolean | null;
  searchLogId: string | null;
  partId: string | null;
}

export type FieldErrors = Partial<Record<string, string>>;

export type ValidationResult =
  | { ok: true; data: InquiryInput }
  | { ok: false; spam: true }
  | { ok: false; spam: false; errors: FieldErrors };

const ITEM_BUCKETS: ItemCountBucket[] = ["one", "two_to_ten", "eleven_plus"];
const PURCHASE_TYPES: PurchaseType[] = ["company", "personal"];
const MAX = { mpn: 64, company: 100, contactName: 50, phone: 30, email: 254, memo: 2000 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 폼 입력 검증 (docs/SPEC.md 5장). 서버에서 항상 다시 검증한다. */
export function validateInquiry(type: InquiryType, form: FormData): ValidationResult {
  if (str(form, HONEYPOT_FIELD) !== "") return { ok: false, spam: true };

  const errors: FieldErrors = {};
  const mpn = str(form, "mpn");
  const qtyRaw = str(form, "qty");
  const dueRaw = str(form, "dueDate");
  const dueNegotiable = form.get("dueNegotiable") === "on";
  const itemCountBucket = str(form, "itemCountBucket") as ItemCountBucket;
  const purchaseType = str(form, "purchaseType") as PurchaseType;
  const company = str(form, "company");
  const contactName = str(form, "contactName");
  const phone = str(form, "phone");
  const email = str(form, "email");
  const memo = str(form, "memo");
  const consentPrivacy = form.get("consentPrivacy") === "on";
  const consentThirdParty = form.get("consentThirdParty") === "on";
  const searchLogRaw = str(form, "searchLogId");
  const partIdRaw = str(form, "partId");

  if (mpn === "") errors.mpn = "품번을 입력해 주세요.";
  else if (mpn.length > MAX.mpn) errors.mpn = `품번은 ${MAX.mpn}자 이하로 입력해 주세요.`;

  const qty = /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : NaN;
  if (!Number.isSafeInteger(qty) || qty < 1) errors.qty = "수량은 1 이상의 정수로 입력해 주세요.";

  let dueDate: Date | null = null;
  if (dueRaw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw) || Number.isNaN(Date.parse(`${dueRaw}T00:00:00Z`))) {
      errors.dueDate = "날짜 형식이 올바르지 않습니다.";
    } else {
      dueDate = new Date(`${dueRaw}T00:00:00Z`);
    }
  }

  if (!ITEM_BUCKETS.includes(itemCountBucket)) errors.itemCountBucket = "이번 구매 품목 수를 선택해 주세요.";
  if (!PURCHASE_TYPES.includes(purchaseType)) errors.purchaseType = "구매 용도를 선택해 주세요.";
  if (purchaseType === "company" && company === "") errors.company = "회사명을 입력해 주세요.";
  if (company.length > MAX.company) errors.company = `회사명은 ${MAX.company}자 이하로 입력해 주세요.`;

  if (contactName === "") errors.contactName = "담당자명을 입력해 주세요.";
  else if (contactName.length > MAX.contactName) errors.contactName = "담당자명이 너무 깁니다.";

  if (phone === "") errors.phone = "연락처를 입력해 주세요.";
  else if (!/^[0-9+\-() ]{8,}$/.test(phone) || phone.length > MAX.phone) errors.phone = "연락처 형식이 올바르지 않습니다.";

  if (email === "") errors.email = "이메일을 입력해 주세요.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email) {
    errors.email = "이메일 형식이 올바르지 않습니다.";
  }

  if (memo.length > MAX.memo) errors.memo = `메모는 ${MAX.memo}자 이하로 입력해 주세요.`;

  if (!consentPrivacy) errors.consentPrivacy = "개인정보 수집·이용에 동의해 주세요.";
  if (type === "sourcing" && !consentThirdParty) errors.consentThirdParty = "개인정보 제3자 제공에 동의해 주세요.";

  if (Object.keys(errors).length > 0) return { ok: false, spam: false, errors };

  return {
    ok: true,
    data: {
      type,
      mpn,
      qty,
      dueDate,
      dueNegotiable: dueDate == null && dueNegotiable,
      itemCountBucket,
      purchaseType,
      company: purchaseType === "company" ? company : company || null,
      contactName,
      phone,
      email,
      memo: memo || null,
      consentPrivacy: true,
      // 견적 문의에는 제3자 제공 동의 항목이 없다
      consentThirdParty: type === "sourcing" ? true : null,
      searchLogId: UUID_RE.test(searchLogRaw) ? searchLogRaw : null,
      partId: UUID_RE.test(partIdRaw) ? partIdRaw : null,
    },
  };
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
