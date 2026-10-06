import type { InquiryType, ItemCountBucket, PurchaseType } from "@/generated/prisma/enums";
import { fmt, getDictionary, type Dict } from "@/i18n";

type ErrorMessages = Dict["errors"];

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

/** 부품 요청 품목 한 줄 */
export interface RequestItemInput {
  position: number;
  mpn: string;
  manufacturer: string | null;
  qty: number;
  note: string | null;
}

/** 첨부 파일 (검증만 끝난 상태, 바이트는 저장 직전에 읽는다) */
export interface AttachmentInput {
  file: File;
  filename: string;
  contentType: string;
}

export interface RequestInput {
  inquiry: InquiryInput;
  items: RequestItemInput[];
  attachment: AttachmentInput | null;
}

export type RequestValidationResult =
  | { ok: true; data: RequestInput }
  | { ok: false; spam: true }
  | { ok: false; spam: false; errors: FieldErrors };

export const REQUEST_LIMITS = {
  maxItems: 100,
  maxFileBytes: 5 * 1024 * 1024,
  fileExtensions: ["xlsx", "xls", "csv", "txt", "pdf", "png", "jpg", "jpeg"],
};

const CONTENT_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export type ValidationResult =
  | { ok: true; data: InquiryInput }
  | { ok: false; spam: true }
  | { ok: false; spam: false; errors: FieldErrors };

const ITEM_BUCKETS: ItemCountBucket[] = ["one", "two_to_ten", "eleven_plus"];
const PURCHASE_TYPES: PurchaseType[] = ["company", "personal"];
const MAX = { mpn: 64, manufacturer: 64, note: 200, company: 100, contactName: 50, phone: 30, email: 254, memo: 2000 };
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

/**
 * 부품 요청 검증: 품목 여러 줄(itemMpn/itemQty/itemMfr/itemNote 반복) + 선택 첨부 + 연락처.
 * 품목이 하나도 없으면 첨부 파일이 있어야 한다. 제3자 제공 동의는 선택 (동의하지 않으면 정식 유통 경로로만 찾는다).
 */
export function validateRequest(form: FormData, msg: ErrorMessages = getDictionary("ko").errors): RequestValidationResult {
  if (str(form, HONEYPOT_FIELD) !== "") return { ok: false, spam: true };
  const errors: FieldErrors = {};

  const all = (k: string) => form.getAll(k).map((v) => (typeof v === "string" ? v.trim() : ""));
  const mpns = all("itemMpn");
  const qtys = all("itemQty");
  const mfrs = all("itemMfr");
  const notes = all("itemNote");
  const items: RequestItemInput[] = [];
  const rows = Math.min(mpns.length, REQUEST_LIMITS.maxItems + 1);
  for (let i = 0; i < rows; i++) {
    const mpn = mpns[i] ?? "";
    const qtyRaw = qtys[i] ?? "";
    const mfr = mfrs[i] ?? "";
    const note = notes[i] ?? "";
    if (mpn === "" && qtyRaw === "" && mfr === "" && note === "") continue; // 빈 줄
    const key = `item${i}`;
    const qty = /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : NaN;
    if (mpn === "") errors[key] = msg.itemMpn;
    else if (mpn.length > MAX.mpn) errors[key] = fmt(msg.itemMpnLong, { max: MAX.mpn });
    else if (!Number.isSafeInteger(qty) || qty < 1) errors[key] = msg.itemQty;
    else if (mfr.length > MAX.manufacturer || note.length > MAX.note) errors[key] = msg.itemLong;
    else items.push({ position: items.length + 1, mpn, manufacturer: mfr || null, qty, note: note || null });
  }
  if (items.length > REQUEST_LIMITS.maxItems) errors.items = fmt(msg.itemsTooMany, { max: REQUEST_LIMITS.maxItems });

  let attachment: AttachmentInput | null = null;
  const file = form.get("attachment");
  if (file instanceof File && file.size > 0) {
    const filename = file.name.replace(/[\\/\u0000-\u001f\u007f]+/g, "_").slice(-120) || "attachment";
    const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
    if (!REQUEST_LIMITS.fileExtensions.includes(ext)) {
      errors.attachment = fmt(msg.attachType, { exts: REQUEST_LIMITS.fileExtensions.join(", ") });
    } else if (file.size > REQUEST_LIMITS.maxFileBytes) {
      errors.attachment = msg.attachSize;
    } else {
      attachment = { file, filename, contentType: CONTENT_TYPES[ext] };
    }
  }
  if (items.length === 0 && !attachment && !errors.attachment && !Object.keys(errors).some((k) => k.startsWith("item"))) {
    errors.items = msg.itemsEmpty;
  }

  const contact = validateContact(form, errors, msg);
  if (Object.keys(errors).length > 0 || !contact) return { ok: false, spam: false, errors };

  const n = items.length;
  const itemCountBucket: ItemCountBucket = n >= 11 ? "eleven_plus" : n >= 2 || attachment ? "two_to_ten" : "one";
  const head = items[0];
  return {
    ok: true,
    data: {
      inquiry: {
        type: "request",
        // 목록·메일 제목용 대표값. 품목 없이 파일만 보낸 경우 파일명을 쓴다
        mpn: head ? head.mpn : `[첨부] ${attachment!.filename}`.slice(0, MAX.mpn),
        qty: head ? head.qty : 0,
        itemCountBucket,
        ...contact,
        consentThirdParty: form.get("consentThirdParty") === "on",
      },
      items,
      attachment,
    },
  };
}

/** 연락처·납기·동의 공통 검증. 오류는 errors 에 채우고, 통과하면 값을 돌려준다 */
function validateContact(form: FormData, errors: FieldErrors, msg: ErrorMessages) {
  const dueRaw = str(form, "dueDate");
  const dueNegotiable = form.get("dueNegotiable") === "on";
  const purchaseType = str(form, "purchaseType") as PurchaseType;
  const company = str(form, "company");
  const contactName = str(form, "contactName");
  const phone = str(form, "phone");
  const email = str(form, "email");
  const memo = str(form, "memo");
  const searchLogRaw = str(form, "searchLogId");
  const partIdRaw = str(form, "partId");
  const before = Object.keys(errors).length;

  let dueDate: Date | null = null;
  if (dueRaw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw) || Number.isNaN(Date.parse(`${dueRaw}T00:00:00Z`))) errors.dueDate = msg.dueDate;
    else dueDate = new Date(`${dueRaw}T00:00:00Z`);
  }
  if (!PURCHASE_TYPES.includes(purchaseType)) errors.purchaseType = msg.purchaseType;
  if (purchaseType === "company" && company === "") errors.company = msg.company;
  if (company.length > MAX.company) errors.company = fmt(msg.companyLong, { max: MAX.company });
  if (contactName === "") errors.contactName = msg.contactName;
  else if (contactName.length > MAX.contactName) errors.contactName = msg.contactNameLong;
  if (phone === "") errors.phone = msg.phone;
  else if (!/^[0-9+\-() ]{8,}$/.test(phone) || phone.length > MAX.phone) errors.phone = msg.phoneInvalid;
  if (email === "") errors.email = msg.email;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email) errors.email = msg.emailInvalid;
  if (memo.length > MAX.memo) errors.memo = fmt(msg.memoLong, { max: MAX.memo });
  if (form.get("consentPrivacy") !== "on") errors.consentPrivacy = msg.consentPrivacy;
  if (Object.keys(errors).length > before) return null;

  return {
    dueDate,
    dueNegotiable: dueDate == null && dueNegotiable,
    purchaseType,
    company: company || null,
    contactName,
    phone,
    email,
    memo: memo || null,
    consentPrivacy: true as const,
    searchLogId: UUID_RE.test(searchLogRaw) ? searchLogRaw : null,
    partId: UUID_RE.test(partIdRaw) ? partIdRaw : null,
  };
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
