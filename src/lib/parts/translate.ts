import { createHash } from "node:crypto";
import type { Locale } from "@/i18n/config";

/**
 * 부품 페이지 번역 (en·ja·es). 원문은 관리자가 입력한 한국어 콘텐츠.
 * - 원문 해시로 '번역 이후 원문이 바뀌었는지' 판단한다.
 * - 번역 결과는 원문과 개수·id 가 같아야 하고, 숫자·품번이 그대로 남아 있어야 한다 (검증).
 */

export type TranslatableLocale = Exclude<Locale, "ko">;
export const TRANSLATABLE_LOCALES: TranslatableLocale[] = ["en", "ja", "es"];

export interface TranslationSource {
  summary: string | null;
  specs: { label: string; value: string }[];
  faqs: { q: string; a: string }[];
  /** 대체품 비고 (비고가 있는 것만) */
  altNotes: { id: string; note: string }[];
}

export interface TranslationOutput {
  summary: string | null;
  specs: { label: string; value: string }[];
  faqs: { q: string; a: string }[];
  altNotes: { id: string; note: string }[];
}

export function sourceHash(src: TranslationSource): string {
  return createHash("sha256").update(JSON.stringify(src)).digest("hex").slice(0, 32);
}

export const isEmptySource = (src: TranslationSource) =>
  !src.summary && src.specs.length === 0 && src.faqs.length === 0 && src.altNotes.length === 0;

const LANGUAGE_NAME: Record<TranslatableLocale, string> = { en: "English", ja: "Japanese", es: "Spanish" };

export function translationSystemPrompt(locale: TranslatableLocale): string {
  const lang = LANGUAGE_NAME[locale];
  return `You translate Korean content of an electronic component information page into ${lang}.
The text is read by purchasing and engineering staff and may be quoted by search engines and AI answer engines.

Rules:
- Translate faithfully. Do not add, remove or embellish facts; do not add marketing language.
- Keep part numbers (MPNs), manufacturer names, package names, numbers, units, dates and abbreviations such as EOL, NRND, LTB exactly as written.
- Use the standard ${lang} terminology of the electronics industry (e.g. datasheet, pin-compatible, end of life).
- Keep every list in the same order and length as the input, and keep each "id" unchanged.
- For spec values, translate only words; leave values that are only numbers, units or part numbers unchanged.
- If a field is null or empty in the input, return it null or empty.`;
}

export function translationUserPrompt(src: TranslationSource): string {
  return `Translate the "summary", every spec "label" and "value", every FAQ "q" and "a", and every "note" in this JSON:\n\n${JSON.stringify(src, null, 2)}`;
}

/** 구조화 출력 스키마 (output_config.format) */
export const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: ["string", "null"] },
    specs: {
      type: "array",
      items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"], additionalProperties: false },
    },
    faqs: {
      type: "array",
      items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"], additionalProperties: false },
    },
    altNotes: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, note: { type: "string" } }, required: ["id", "note"], additionalProperties: false },
    },
  },
  required: ["summary", "specs", "faqs", "altNotes"],
  additionalProperties: false,
} as const;

/**
 * 번역 결과 검증. 문제가 있으면 이유 목록을 돌려준다 (빈 배열이면 통과).
 * - 개수·id 일치
 * - 원문에 있는 숫자·품번처럼 보이는 토큰(영문+숫자)이 번역에도 남아 있는지
 */
export function checkTranslation(src: TranslationSource, out: TranslationOutput): string[] {
  const problems: string[] = [];
  if ((src.summary ?? "") !== "" && !(out.summary ?? "").trim()) problems.push("요약이 비어 있습니다.");
  if (out.specs.length !== src.specs.length) problems.push("스펙 개수가 다릅니다.");
  if (out.faqs.length !== src.faqs.length) problems.push("FAQ 개수가 다릅니다.");
  const ids = src.altNotes.map((n) => n.id).sort().join(",");
  if (out.altNotes.map((n) => n.id).sort().join(",") !== ids) problems.push("대체품 비고 id 가 다릅니다.");

  const tokens = (s: string) => new Set(s.match(/[A-Za-z0-9][A-Za-z0-9.\-/]*\d[A-Za-z0-9.\-/]*|\d+(?:\.\d+)?/g) ?? []);
  const srcText = [src.summary ?? "", ...src.specs.map((s) => s.value), ...src.faqs.flatMap((f) => [f.q, f.a]), ...src.altNotes.map((n) => n.note)].join(" ");
  const outText = [out.summary ?? "", ...out.specs.map((s) => s.value), ...out.faqs.flatMap((f) => [f.q, f.a]), ...out.altNotes.map((n) => n.note)].join(" ");
  const outTokens = tokens(outText);
  const missing = [...tokens(srcText)].filter((t) => !outTokens.has(t) && !outText.includes(t));
  if (missing.length > 0) problems.push(`원문의 숫자·품번이 빠졌습니다: ${missing.slice(0, 5).join(", ")}`);
  return problems;
}
