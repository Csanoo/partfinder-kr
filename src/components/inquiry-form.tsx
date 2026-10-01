"use client";

import { useActionState, useState } from "react";
import type { InquiryFormState } from "@/app/inquiry/actions";
import { HONEYPOT_FIELD } from "@/lib/inquiry/validate";

type Action = (prev: InquiryFormState, formData: FormData) => Promise<InquiryFormState>;

interface Props {
  type: "quote" | "sourcing";
  action: Action;
  defaults: { mpn: string; qty: string; searchLogId: string };
  consent: { privacy: string; thirdParty: string };
}

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200 dark:focus-visible:ring-brand-800 aria-[invalid=true]:border-red-500";

export function InquiryForm({ type, action, defaults, consent }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [purchaseType, setPurchaseType] = useState(v("purchaseType", "company"));
  const err = (name: string) => state.errors?.[name];

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-line bg-surface p-6" noValidate>
      {state.message && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.message}
        </p>
      )}

      {/* 스팸 방지 honeypot: 사람에게는 보이지 않는 필드 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          웹사이트
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="searchLogId" value={defaults.searchLogId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="품번" required error={err("mpn")} htmlFor="mpn">
          <input id="mpn" name="mpn" defaultValue={v("mpn", defaults.mpn)} required maxLength={64} className={`${input} mpn`} aria-invalid={!!err("mpn")} />
        </Field>
        <Field label="수량" required error={err("qty")} htmlFor="qty">
          <input id="qty" name="qty" type="number" min={1} step={1} defaultValue={v("qty", defaults.qty)} required className={input} aria-invalid={!!err("qty")} />
        </Field>
      </div>

      <Field label="희망 납기" error={err("dueDate")} htmlFor="dueDate">
        <div className="flex flex-wrap items-center gap-3">
          <input id="dueDate" name="dueDate" type="date" defaultValue={v("dueDate")} className={`${input} sm:w-48`} aria-invalid={!!err("dueDate")} />
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" name="dueNegotiable" defaultChecked={v("dueNegotiable") === "on"} /> 협의
          </label>
        </div>
      </Field>

      <fieldset aria-invalid={!!err("itemCountBucket")}>
        <legend className="mb-1 text-sm font-medium">
          이번 구매 품목 수 <Req />
        </legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            ["one", "1개"],
            ["two_to_ten", "2~10개"],
            ["eleven_plus", "11개 이상"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-1">
              <input type="radio" name="itemCountBucket" value={value} defaultChecked={v("itemCountBucket") === value} required /> {label}
            </label>
          ))}
        </div>
        <ErrorText text={err("itemCountBucket")} />
      </fieldset>

      <fieldset aria-invalid={!!err("purchaseType")}>
        <legend className="mb-1 text-sm font-medium">
          구매 용도 <Req />
        </legend>
        <div className="flex gap-4 text-sm">
          {[
            ["company", "회사"],
            ["personal", "개인"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="purchaseType"
                value={value}
                checked={purchaseType === value}
                onChange={() => setPurchaseType(value)}
              />{" "}
              {label}
            </label>
          ))}
        </div>
        <ErrorText text={err("purchaseType")} />
      </fieldset>

      <Field label="회사명" required={purchaseType === "company"} error={err("company")} htmlFor="company">
        <input id="company" name="company" defaultValue={v("company")} maxLength={100} className={input} aria-invalid={!!err("company")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="담당자명" required error={err("contactName")} htmlFor="contactName">
          <input id="contactName" name="contactName" autoComplete="name" defaultValue={v("contactName")} required className={input} aria-invalid={!!err("contactName")} />
        </Field>
        <Field label="연락처" required error={err("phone")} htmlFor="phone">
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" defaultValue={v("phone")} required className={input} aria-invalid={!!err("phone")} />
        </Field>
        <Field label="이메일" required error={err("email")} htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={v("email")} required className={input} aria-invalid={!!err("email")} />
        </Field>
      </div>

      <Field label="메모" error={err("memo")} htmlFor="memo">
        <textarea id="memo" name="memo" rows={4} maxLength={2000} defaultValue={v("memo")} className={input} />
      </Field>

      <Consent name="consentPrivacy" text={consent.privacy} label="개인정보 수집·이용에 동의합니다." checked={v("consentPrivacy") === "on"} error={err("consentPrivacy")} />
      {type === "sourcing" && (
        <Consent name="consentThirdParty" text={consent.thirdParty} label="개인정보 제3자 제공에 동의합니다." checked={v("consentThirdParty") === "on"} error={err("consentThirdParty")} />
      )}

      <button
        type="submit"
        disabled={pending}
        className={`w-full rounded-lg px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto ${type === "quote" ? "bg-brand-600 hover:bg-brand-700" : "bg-copper-500 hover:bg-copper-600"}`}
      >
        {pending ? "접수 중…" : type === "quote" ? "견적 문의 접수" : "소싱 문의 접수"}
      </button>
    </form>
  );
}

function Req() {
  return (
    <span className="text-red-600" aria-label="필수">
      *
    </span>
  );
}

function ErrorText({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-600">{text}</p> : null;
}

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label} {required && <Req />}
      </label>
      {children}
      <ErrorText text={error} />
    </div>
  );
}

function Consent({ name, text, label, checked, error }: { name: string; text: string; label: string; checked: boolean; error?: string }) {
  return (
    <div>
      <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-background p-3 font-sans text-xs text-muted">
        {text}
      </pre>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} defaultChecked={checked} required className="size-4 accent-brand-600" /> {label} <Req />
      </label>
      <ErrorText text={error} />
    </div>
  );
}
