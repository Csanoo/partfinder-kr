"use client";

import { useActionState, useRef, useState } from "react";
import type { Dict } from "@/i18n";
import type { InquiryFormState } from "@/lib/inquiry/actions";
import { track } from "@/lib/client/track";
import { HONEYPOT_FIELD, REQUEST_LIMITS } from "@/lib/inquiry/validate";

type Action = (prev: InquiryFormState, formData: FormData) => Promise<InquiryFormState>;

interface Row {
  key: number;
  mpn: string;
  qty: string;
  mfr: string;
  note: string;
}

interface Props {
  action: Action;
  defaults: { mpn?: string; qty?: string; searchLogId?: string; partId?: string };
  consent: { privacy: string; thirdParty: string };
  /** 화면 문구 (서버에서 언어별 사전의 form 부분만 넘긴다) */
  t: Dict["form"];
  locale: string;
  /** 좁은 영역(부품 페이지 사이드바)용: 한 열 배치, 테두리 없음, 품목 한 줄로 시작 */
  compact?: boolean;
}

const input =
  "w-full rounded-md border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500 aria-[invalid=true]:border-red-500";

let nextKey = 1;
const newRow = (r: Partial<Row> = {}): Row => ({ key: nextKey++, mpn: "", qty: "", mfr: "", note: "", ...r });

/** "품번 수량" 줄 붙여넣기 → 품목 줄 (탭·쉼표·공백 구분, 엑셀에서 두 열 복사 가능) */
function parsePasted(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [mpn = "", qty = "", ...rest] = l.split(/\t|,|\s{1,}/).filter(Boolean);
      return newRow({ mpn, qty: qty.replace(/[^\d]/g, ""), mfr: rest.join(" ") });
    });
}

/** 부품 요청 폼: 여러 품목 + BOM 첨부 + 연락처 */
export function RequestForm({ action, defaults, consent, t, locale, compact = false }: Props) {
  const f = (tpl: string, n: number | string) => tpl.replace(/\{\w+\}/, String(n));
  const [state, formAction, pending] = useActionState(action, {});
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const err = (name: string) => state.errors?.[name];
  const [purchaseType, setPurchaseType] = useState(v("purchaseType", "company"));
  const [rows, setRows] = useState<Row[]>(() => {
    const first = newRow({ mpn: defaults.mpn ?? "", qty: defaults.qty ?? "" });
    return compact || defaults.mpn ? [first] : [first, newRow(), newRow()];
  });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // 서버 검증 오류 후: 입력했던 품목 줄을 되살린다 (렌더 중 상태 갱신, 응답이 바뀔 때 한 번)
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.items && state.items.length > 0) setRows(state.items.map((it) => newRow(it)));
  }
  const opened = useRef(false);
  const onFirstFocus = () => {
    if (opened.current) return;
    opened.current = true;
    track("sourcing_form_open", defaults.partId ?? null);
  };

  const update = (key: number, field: keyof Omit<Row, "key">, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [newRow()]));
  const add = () => setRows((rs) => (rs.length < REQUEST_LIMITS.maxItems ? [...rs, newRow()] : rs));
  const applyPaste = () => {
    const parsed = parsePasted(pasteText);
    if (parsed.length > 0) {
      setRows((rs) => [...rs.filter((r) => r.mpn || r.qty), ...parsed].slice(0, REQUEST_LIMITS.maxItems));
    }
    setPasteText("");
    setPasteOpen(false);
  };

  return (
    <form
      action={formAction}
      className={compact ? "space-y-4 text-sm" : "space-y-6 rounded-md border border-line bg-surface p-4 sm:p-6"}
      onFocusCapture={onFirstFocus}
      noValidate
    >
      {state.message && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.message}
        </p>
      )}

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          {t.honeypot}
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="searchLogId" value={defaults.searchLogId ?? ""} />
      <input type="hidden" name="partId" value={defaults.partId ?? ""} />
      <input type="hidden" name="locale" value={locale} />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">{t.itemsLegend}</legend>
        <div className="space-y-2">
          {!compact && (
            <div className="hidden grid-cols-[1fr_7rem_1fr_1fr_2rem] gap-2 text-xs font-medium text-muted sm:grid">
              <span>
                {t.colMpn} <Req label={t.required} />
              </span>
              <span>
                {t.colQty} <Req label={t.required} />
              </span>
              <span>{t.colMfr}</span>
              <span>{t.colNote}</span>
              <span />
            </div>
          )}
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className={compact ? "grid grid-cols-[1fr_6rem_2rem] gap-2" : "grid grid-cols-[1fr_6rem_2rem] gap-2 sm:grid-cols-[1fr_7rem_1fr_1fr_2rem]"}>
                <input
                  name="itemMpn"
                  value={r.mpn}
                  onChange={(e) => update(r.key, "mpn", e.target.value)}
                  placeholder={i === 0 ? t.phMpnFirst : t.phMpn}
                  aria-label={f(t.ariaMpn, i + 1)}
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${input} mpn`}
                  aria-invalid={!!err(`item${i}`)}
                />
                <input
                  name="itemQty"
                  value={r.qty}
                  onChange={(e) => update(r.key, "qty", e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder={t.phQty}
                  aria-label={f(t.ariaQty, i + 1)}
                  className={input}
                  aria-invalid={!!err(`item${i}`)}
                />
                {compact ? (
                  <>
                    <input type="hidden" name="itemMfr" value={r.mfr} />
                    <input type="hidden" name="itemNote" value={r.note} />
                  </>
                ) : (
                  <>
                    <input
                      name="itemMfr"
                      value={r.mfr}
                      onChange={(e) => update(r.key, "mfr", e.target.value)}
                      placeholder={t.phMfr}
                      aria-label={f(t.ariaMfr, i + 1)}
                      maxLength={64}
                      className={`${input} col-span-2 hidden sm:col-span-1 sm:block`}
                    />
                    <input
                      name="itemNote"
                      value={r.note}
                      onChange={(e) => update(r.key, "note", e.target.value)}
                      placeholder={t.phNote}
                      aria-label={f(t.ariaNote, i + 1)}
                      maxLength={200}
                      className={`${input} hidden sm:block`}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  aria-label={f(t.ariaRemove, i + 1)}
                  className="rounded-md text-lg leading-none text-muted hover:bg-background hover:text-foreground"
                >
                  ×
                </button>
              </div>
              <ErrorText text={err(`item${i}`)} />
            </div>
          ))}
        </div>
        <ErrorText text={err("items")} />
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={add} className="rounded-md border border-line px-3 py-1.5 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-200">
            {t.addRow}
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => setPasteOpen((o) => !o)}
              className="rounded-md border border-line px-3 py-1.5 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-200"
            >
              {t.paste}
            </button>
          )}
        </div>
        {pasteOpen && (
          <div className="space-y-2 rounded-md border border-line bg-background p-3">
            <label htmlFor="paste" className="block text-xs text-muted">
              {t.pasteHelp}
            </label>
            <textarea
              id="paste"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"ULN2003A 500\nLM358N 1000"}
              className={`${input} mpn`}
            />
            <button type="button" onClick={applyPaste} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
              {t.pasteApply}
            </button>
          </div>
        )}

        <div>
          <label htmlFor="attachment" className="mb-1 block text-sm font-medium">
            {t.attach} <span className="font-normal text-muted">{f(t.attachHint, REQUEST_LIMITS.fileExtensions.join("·"))}</span>
          </label>
          <input
            id="attachment"
            name="attachment"
            type="file"
            accept={REQUEST_LIMITS.fileExtensions.map((e) => `.${e}`).join(",")}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm hover:file:border-brand-500"
            aria-invalid={!!err("attachment")}
          />
          <ErrorText text={err("attachment")} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-bold">{t.contactLegend}</legend>
        <Field label={t.due} req={t.required} error={err("dueDate")} htmlFor="dueDate">
          <div className="flex flex-wrap items-center gap-3">
            <input id="dueDate" name="dueDate" type="date" defaultValue={v("dueDate")} className={`${input} sm:w-48`} aria-invalid={!!err("dueDate")} />
            <label className="inline-flex items-center gap-1 text-sm">
              <input type="checkbox" name="dueNegotiable" defaultChecked={v("dueNegotiable") === "on"} /> {t.negotiable}
            </label>
          </div>
        </Field>

        <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-[auto_1fr]"}>
          <fieldset aria-invalid={!!err("purchaseType")}>
            <legend className="mb-1 text-sm font-medium">
              {t.purchaseType} <Req label={t.required} />
            </legend>
            <div className="flex h-10 items-center gap-4 text-sm">
              {[
                ["company", t.purchaseCompany],
                ["personal", t.purchasePersonal],
              ].map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-1">
                  <input type="radio" name="purchaseType" value={value} checked={purchaseType === value} onChange={() => setPurchaseType(value)} /> {label}
                </label>
              ))}
            </div>
            <ErrorText text={err("purchaseType")} />
          </fieldset>
          <Field label={t.company} req={t.required} required={purchaseType === "company"} error={err("company")} htmlFor="company">
            <input id="company" name="company" autoComplete="organization" defaultValue={v("company")} maxLength={100} className={input} aria-invalid={!!err("company")} />
          </Field>
        </div>

        <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-3"}>
          <Field label={t.contactName} req={t.required} required error={err("contactName")} htmlFor="contactName">
            <input id="contactName" name="contactName" autoComplete="name" defaultValue={v("contactName")} className={input} aria-invalid={!!err("contactName")} />
          </Field>
          <Field label={t.phone} req={t.required} required error={err("phone")} htmlFor="phone">
            <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder={t.phPhone} defaultValue={v("phone")} className={input} aria-invalid={!!err("phone")} />
          </Field>
          <Field label={t.email} req={t.required} required error={err("email")} htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={v("email")} className={input} aria-invalid={!!err("email")} />
          </Field>
        </div>

        <Field label={t.memo} req={t.required} error={err("memo")} htmlFor="memo">
          <textarea
            id="memo"
            name="memo"
            rows={compact ? 3 : 4}
            maxLength={2000}
            defaultValue={v("memo")}
            placeholder={t.phMemo}
            className={input}
          />
        </Field>
      </fieldset>

      <div className="space-y-3">
        <Consent name="consentPrivacy" text={consent.privacy} label={t.consentPrivacy} more={t.viewContent} req={t.required} required checked={v("consentPrivacy") === "on"} error={err("consentPrivacy")} />
        <Consent
          name="consentThirdParty"
          text={consent.thirdParty}
          label={t.consentThird}
          hint={t.consentThirdHint}
          more={t.viewContent}
          req={t.required}
          checked={v("consentThirdParty") === "on"}
        />
      </div>

      <button type="submit" disabled={pending} className="w-full rounded-md bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto">
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}

function Req({ label }: { label: string }) {
  return (
    <span className="text-red-600" aria-label={label}>
      *
    </span>
  );
}

function ErrorText({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-600">{text}</p> : null;
}

function Field({
  label,
  req,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  req: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label} {required && <Req label={req} />}
      </label>
      {children}
      <ErrorText text={error} />
    </div>
  );
}

function Consent({
  name,
  text,
  label,
  hint,
  more,
  req,
  required = false,
  checked,
  error,
}: {
  name: string;
  text: string;
  label: string;
  hint?: string;
  more: string;
  req: string;
  required?: boolean;
  checked: boolean;
  error?: string;
}) {
  return (
    <div>
      <details className="rounded-md border border-line">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-brand-600" /> {label} {required && <Req label={req} />}
          </label>
          <span className="ml-auto text-xs text-muted underline">{more}</span>
        </summary>
        <pre className="whitespace-pre-wrap border-t border-line bg-background px-3 py-2 font-sans text-xs text-muted">{text}</pre>
      </details>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <ErrorText text={error} />
    </div>
  );
}
