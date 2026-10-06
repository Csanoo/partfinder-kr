"use client";

import { useActionState, useRef, useState } from "react";
import type { InquiryFormState } from "@/app/inquiry/actions";
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
export function RequestForm({ action, defaults, consent, compact = false }: Props) {
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
          웹사이트
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="searchLogId" value={defaults.searchLogId ?? ""} />
      <input type="hidden" name="partId" value={defaults.partId ?? ""} />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">필요한 부품</legend>
        <div className="space-y-2">
          {!compact && (
            <div className="hidden grid-cols-[1fr_7rem_1fr_1fr_2rem] gap-2 text-xs font-medium text-muted sm:grid">
              <span>
                품번(MPN) <Req />
              </span>
              <span>
                수량 <Req />
              </span>
              <span>제조사 (선택)</span>
              <span>비고 (선택)</span>
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
                  placeholder={i === 0 ? "예: ULN2003A" : "품번"}
                  aria-label={`${i + 1}번 품번`}
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
                  placeholder="수량"
                  aria-label={`${i + 1}번 수량`}
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
                      placeholder="제조사"
                      aria-label={`${i + 1}번 제조사`}
                      maxLength={64}
                      className={`${input} col-span-2 hidden sm:col-span-1 sm:block`}
                    />
                    <input
                      name="itemNote"
                      value={r.note}
                      onChange={(e) => update(r.key, "note", e.target.value)}
                      placeholder="대체품 가능 등"
                      aria-label={`${i + 1}번 비고`}
                      maxLength={200}
                      className={`${input} hidden sm:block`}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  aria-label={`${i + 1}번 품목 삭제`}
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
            + 품목 추가
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => setPasteOpen((o) => !o)}
              className="rounded-md border border-line px-3 py-1.5 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-200"
            >
              여러 줄 붙여넣기
            </button>
          )}
        </div>
        {pasteOpen && (
          <div className="space-y-2 rounded-md border border-line bg-background p-3">
            <label htmlFor="paste" className="block text-xs text-muted">
              한 줄에 &quot;품번 수량&quot; (엑셀에서 두 열을 복사해 붙여넣어도 됩니다)
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
              품목으로 넣기
            </button>
          </div>
        )}

        <div>
          <label htmlFor="attachment" className="mb-1 block text-sm font-medium">
            BOM·목록 파일 첨부 <span className="font-normal text-muted">(선택, {REQUEST_LIMITS.fileExtensions.join("·")}, 5MB 이하)</span>
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
        <legend className="mb-2 text-base font-bold">납기·연락처</legend>
        <Field label="희망 납기" error={err("dueDate")} htmlFor="dueDate">
          <div className="flex flex-wrap items-center gap-3">
            <input id="dueDate" name="dueDate" type="date" defaultValue={v("dueDate")} className={`${input} sm:w-48`} aria-invalid={!!err("dueDate")} />
            <label className="inline-flex items-center gap-1 text-sm">
              <input type="checkbox" name="dueNegotiable" defaultChecked={v("dueNegotiable") === "on"} /> 협의
            </label>
          </div>
        </Field>

        <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-[auto_1fr]"}>
          <fieldset aria-invalid={!!err("purchaseType")}>
            <legend className="mb-1 text-sm font-medium">
              구매 용도 <Req />
            </legend>
            <div className="flex h-10 items-center gap-4 text-sm">
              {[
                ["company", "회사"],
                ["personal", "개인"],
              ].map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-1">
                  <input type="radio" name="purchaseType" value={value} checked={purchaseType === value} onChange={() => setPurchaseType(value)} /> {label}
                </label>
              ))}
            </div>
            <ErrorText text={err("purchaseType")} />
          </fieldset>
          <Field label="회사명" required={purchaseType === "company"} error={err("company")} htmlFor="company">
            <input id="company" name="company" autoComplete="organization" defaultValue={v("company")} maxLength={100} className={input} aria-invalid={!!err("company")} />
          </Field>
        </div>

        <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-3"}>
          <Field label="담당자명" required error={err("contactName")} htmlFor="contactName">
            <input id="contactName" name="contactName" autoComplete="name" defaultValue={v("contactName")} className={input} aria-invalid={!!err("contactName")} />
          </Field>
          <Field label="연락처" required error={err("phone")} htmlFor="phone">
            <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" defaultValue={v("phone")} className={input} aria-invalid={!!err("phone")} />
          </Field>
          <Field label="이메일" required error={err("email")} htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={v("email")} className={input} aria-invalid={!!err("email")} />
          </Field>
        </div>

        <Field label="요청 사항" error={err("memo")} htmlFor="memo">
          <textarea
            id="memo"
            name="memo"
            rows={compact ? 3 : 4}
            maxLength={2000}
            defaultValue={v("memo")}
            placeholder="예: 대체품 제안 가능, 날짜 코드 조건, 분할 납품 가능 등"
            className={input}
          />
        </Field>
      </fieldset>

      <div className="space-y-3">
        <Consent name="consentPrivacy" text={consent.privacy} label="개인정보 수집·이용에 동의합니다." required checked={v("consentPrivacy") === "on"} error={err("consentPrivacy")} />
        <Consent
          name="consentThirdParty"
          text={consent.thirdParty}
          label="(선택) 개인정보 제3자 제공에 동의합니다."
          hint="동의하시면 협력 업체를 통해서도 찾아드립니다. 동의하지 않으셔도 정식 유통 경로로 찾아드립니다."
          checked={v("consentThirdParty") === "on"}
        />
      </div>

      <button type="submit" disabled={pending} className="w-full rounded-md bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto">
        {pending ? "보내는 중…" : "부품 요청 보내기"}
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

function Field({ label, required, error, htmlFor, children }: { label: string; required?: boolean; error?: string; htmlFor: string; children: React.ReactNode }) {
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

function Consent({
  name,
  text,
  label,
  hint,
  required = false,
  checked,
  error,
}: {
  name: string;
  text: string;
  label: string;
  hint?: string;
  required?: boolean;
  checked: boolean;
  error?: string;
}) {
  return (
    <div>
      <details className="rounded-md border border-line">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-brand-600" /> {label} {required && <Req />}
          </label>
          <span className="ml-auto text-xs text-muted underline">내용 보기</span>
        </summary>
        <pre className="whitespace-pre-wrap border-t border-line bg-background px-3 py-2 font-sans text-xs text-muted">{text}</pre>
      </details>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <ErrorText text={error} />
    </div>
  );
}
