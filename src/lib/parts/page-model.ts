/**
 * 부품 상세 페이지 데이터 모델 + 메타 태그·JSON-LD 생성 (docs/SEO_SPEC.md 5.2, 5.4).
 * DB와 화면에서 분리한 순수 함수라 테스트로 검증한다.
 */

import { DEFAULT_LOCALE, LOCALE_TAG, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

export type Lifecycle = "active" | "nrnd" | "ltb" | "eol" | "unknown";

export interface PartPageModel {
  id: string;
  mpnDisplay: string;
  manufacturer: { slug: string; nameEn: string; nameKo: string };
  category: { slug: string; nameKo: string; nameEn: string } | null;
  package: string | null;
  summaryKo: string | null;
  keySpecs: { label: string; value: string }[];
  lifecycle: {
    status: Lifecycle;
    checkedAt: Date | null;
    source: string | null;
    eolDate: Date | null;
  };
  datasheetUrl: string | null;
  alternatives: {
    id: string;
    mpn: string;
    manufacturerName: string | null;
    /** 게시된 내부 페이지가 있으면 경로 */
    path: string | null;
    relation: "drop_in" | "similar" | "upgrade";
    noteKo: string | null;
    verified: boolean;
  }[];
  faqs: { questionKo: string; answerKo: string }[];
  related: { mpn: string; manufacturerName: string; path: string }[];
  /** 정규 경로 (/parts/{mfr}/{slug}) */
  path: string;
  indexable: boolean;
  /** 화면 언어의 번역 상태: ko 는 원문, machine/manual 은 번역 적용, missing 은 번역 없음(한국어 원문 표시) */
  translation: "original" | "machine" | "manual" | "missing";
}

/** 저장된 번역 (part_translation 한 행) */
export interface StoredTranslation {
  summary: string | null;
  specs: unknown;
  faqs: unknown;
  altNotes: unknown;
  method: string;
}

/**
 * 한국어 모델에 번역을 입힌다 (순수 함수).
 * - 번역이 없으면 한국어 원문 그대로 + translation: "missing" (페이지는 noindex, hreflang 에서 제외)
 * - 개수가 어긋난 항목(원문이 바뀐 뒤 아직 재번역 전)은 원문을 쓴다
 * - 카테고리·제조사 이름은 영문명
 */
export function localizePart(p: PartPageModel, locale: Locale, t: StoredTranslation | null): PartPageModel {
  if (locale === DEFAULT_LOCALE) return { ...p, translation: "original" };
  const category = p.category ? { ...p.category, nameKo: p.category.nameEn } : null;
  const manufacturer = { ...p.manufacturer, nameKo: p.manufacturer.nameEn };
  if (!t) return { ...p, category, manufacturer, translation: "missing" };
  const specs = Array.isArray(t.specs) && t.specs.length === p.keySpecs.length ? (t.specs as { label: string; value: string }[]) : p.keySpecs;
  const faqs =
    Array.isArray(t.faqs) && t.faqs.length === p.faqs.length
      ? (t.faqs as { q: string; a: string }[]).map((f) => ({ questionKo: f.q, answerKo: f.a }))
      : p.faqs;
  const notes = (t.altNotes && typeof t.altNotes === "object" ? t.altNotes : {}) as Record<string, string>;
  return {
    ...p,
    category,
    manufacturer,
    summaryKo: t.summary ?? p.summaryKo,
    keySpecs: specs,
    faqs,
    alternatives: p.alternatives.map((a) => ({ ...a, noteKo: a.noteKo ? (notes[a.id] ?? a.noteKo) : null })),
    translation: t.method === "manual" ? "manual" : "machine",
  };
}

export const LIFECYCLE_TEXT: Record<Lifecycle, string> = getDictionary("ko").part.lifecycleText;

export const RELATION_TEXT: Record<PartPageModel["alternatives"][number]["relation"], string> = getDictionary("ko").part.relationText;

export function manufacturerLabel(m: PartPageModel["manufacturer"]): string {
  return m.nameKo && m.nameKo !== m.nameEn ? `${m.nameEn} (${m.nameKo})` : m.nameEn;
}

/** 5.2 title: `{mpn} 단종·대체품·재고 문의 | {제조사명}`, active면 `재고·구매 문의` (언어별 문구) */
export function buildTitle(p: Pick<PartPageModel, "mpnDisplay" | "manufacturer" | "lifecycle">, locale: Locale = DEFAULT_LOCALE): string {
  const t = getDictionary(locale).part;
  const phrase = p.lifecycle.status === "active" ? t.titleActive : t.titleOther;
  return `${p.mpnDisplay} ${phrase} | ${p.manufacturer.nameEn}`;
}

/** 5.2 description: summary_ko에서 120자 이내. 문장 경계에서 자르고, 못 자르면 말줄임 */
export function buildDescription(summaryKo: string | null, max = 120): string {
  const s = (summaryKo ?? "").replace(/\s+/g, " ").trim();
  const chars = [...s];
  if (chars.length <= max) return s;
  const cut = chars.slice(0, max).join("");
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("다."), cut.lastIndexOf("요."));
  if (lastStop >= max * 0.5) return cut.slice(0, lastStop + (cut[lastStop] === "." ? 1 : 2)).trim();
  return `${chars.slice(0, max - 1).join("").trim()}…`;
}

export function buildRobots(indexable: boolean): { index: boolean; follow: boolean } {
  return { index: indexable, follow: true };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 5.4 JSON-LD. 화면에 보이는 내용만 넣고 offers·price·aggregateRating·review는 넣지 않는다. */
export function buildJsonLd(p: PartPageModel, siteUrl: string, locale: Locale = DEFAULT_LOCALE): Record<string, unknown>[] {
  const abs = (path: string) => new URL(localePath(locale, path), siteUrl).toString();
  const lang = p.translation === "missing" ? LOCALE_TAG.ko : LOCALE_TAG[locale];
  const url = abs(p.path);

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.mpnDisplay,
    mpn: p.mpnDisplay,
    brand: { "@type": "Organization", name: p.manufacturer.nameEn },
    url,
    inLanguage: lang,
  };
  if (p.category) product.category = p.category.nameKo;
  if (p.summaryKo) product.description = p.summaryKo.trim();

  // 홈 > 카테고리 > 제조사 > 부품
  const crumbs: { name: string; item: string }[] = [{ name: getDictionary(locale).common.home, item: abs("/") }];
  if (p.category) crumbs.push({ name: p.category.nameKo, item: abs(`/categories/${p.category.slug}`) });
  crumbs.push({ name: p.manufacturer.nameEn, item: abs(`/manufacturers/${p.manufacturer.slug}`) });
  crumbs.push({ name: p.mpnDisplay, item: url });
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };

  const out: Record<string, unknown>[] = [product, breadcrumb];
  if (p.faqs.length > 0) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: lang,
      mainEntity: p.faqs.map((f) => ({
        "@type": "Question",
        name: f.questionKo,
        acceptedAnswer: { "@type": "Answer", text: f.answerKo },
      })),
    });
  }
  return out;
}

export { ymd };
