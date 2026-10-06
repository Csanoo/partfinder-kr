import { db } from "@/lib/db";
import { isEmptySource, sourceHash, TRANSLATABLE_LOCALES, type TranslatableLocale, type TranslationSource } from "@/lib/parts/translate";
import { translatePart } from "@/lib/parts/translate-llm";

/** 번역할 한국어 원문: 요약, 스펙, 게시된 FAQ(생성 순), 비고가 있는 대체품 */
export async function translationSource(partId: string): Promise<TranslationSource | null> {
  const p = await db().part.findUnique({
    where: { id: partId },
    select: {
      summaryKo: true,
      keySpecs: true,
      faqs: { where: { published: true }, orderBy: { createdAt: "asc" }, select: { questionKo: true, answerKo: true } },
      alternatives: { where: { noteKo: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, noteKo: true } },
    },
  });
  if (!p) return null;
  const specs = Array.isArray(p.keySpecs)
    ? (p.keySpecs as { label?: unknown; value?: unknown }[])
        .filter((s) => typeof s?.label === "string" && typeof s?.value === "string")
        .map((s) => ({ label: s.label as string, value: s.value as string }))
    : [];
  return {
    summary: p.summaryKo?.trim() || null,
    specs,
    faqs: p.faqs.map((f) => ({ q: f.questionKo, a: f.answerKo })),
    altNotes: p.alternatives.filter((a) => a.noteKo?.trim()).map((a) => ({ id: a.id, note: a.noteKo!.trim() })),
  };
}

export type TranslationStatus = "missing" | "current" | "stale";

/** 언어별 번역 상태 (관리자 화면용) */
export async function translationStatus(partId: string): Promise<Record<TranslatableLocale, { status: TranslationStatus; method: string | null; updatedAt: Date | null }>> {
  const [src, rows] = await Promise.all([
    translationSource(partId),
    db().partTranslation.findMany({ where: { partId }, select: { locale: true, sourceHash: true, method: true, updatedAt: true } }),
  ]);
  const hash = src ? sourceHash(src) : "";
  const out = {} as Record<TranslatableLocale, { status: TranslationStatus; method: string | null; updatedAt: Date | null }>;
  for (const l of TRANSLATABLE_LOCALES) {
    const r = rows.find((x) => x.locale === l);
    out[l] = r ? { status: r.sourceHash === hash ? "current" : "stale", method: r.method, updatedAt: r.updatedAt } : { status: "missing", method: null, updatedAt: null };
  }
  return out;
}

/** 지정 언어들을 번역해 저장. 언어별 결과(실패 사유 포함)를 돌려준다 */
export async function translateAndSave(partId: string, locales: TranslatableLocale[] = TRANSLATABLE_LOCALES): Promise<{ locale: TranslatableLocale; ok: boolean; reason?: string }[]> {
  const src = await translationSource(partId);
  if (!src || isEmptySource(src)) return locales.map((locale) => ({ locale, ok: false, reason: "번역할 내용이 없습니다." }));
  const hash = sourceHash(src);
  const results = await Promise.all(
    locales.map(async (locale) => {
      const r = await translatePart(src, locale);
      if (!r.ok) return { locale, ok: false, reason: r.reason };
      const data = {
        summary: r.output.summary,
        specs: r.output.specs,
        faqs: r.output.faqs,
        altNotes: Object.fromEntries(r.output.altNotes.map((n) => [n.id, n.note])),
        sourceHash: hash,
        method: "machine",
      };
      await db().partTranslation.upsert({ where: { partId_locale: { partId, locale } }, create: { partId, locale, ...data }, update: data });
      return { locale, ok: true };
    }),
  );
  return results;
}

/**
 * 정기 작업: 게시된 부품 중 번역이 없거나 원문이 바뀐 것을 limit 개까지 번역.
 * 관리자가 고친 번역(manual)은 원문이 바뀐 경우에도 덮어쓰지 않는다 (관리자 화면에서 '갱신 필요'로 보임).
 */
export async function translateOutdatedParts(limit = 20): Promise<{ checked: number; translated: number; failed: number }> {
  const parts = await db().part.findMany({
    where: { pageStatus: "published" },
    orderBy: { contentUpdatedAt: "desc" },
    select: { id: true, translations: { select: { locale: true, sourceHash: true, method: true } } },
  });
  let translated = 0;
  let failed = 0;
  let checked = 0;
  for (const p of parts) {
    if (translated + failed >= limit) break;
    checked++;
    const src = await translationSource(p.id);
    if (!src || isEmptySource(src)) continue;
    const hash = sourceHash(src);
    const todo = TRANSLATABLE_LOCALES.filter((l) => {
      const t = p.translations.find((x) => x.locale === l);
      return !t || (t.sourceHash !== hash && t.method !== "manual");
    });
    if (todo.length === 0) continue;
    const res = await translateAndSave(p.id, todo);
    translated += res.filter((r) => r.ok).length;
    failed += res.filter((r) => !r.ok).length;
  }
  return { checked, translated, failed };
}
