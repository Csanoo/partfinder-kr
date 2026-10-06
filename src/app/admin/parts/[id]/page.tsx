import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addAlternativeAction,
  addFaqAction,
  addVariantAction,
  applySummaryDraftAction,
  discardSummaryDraftAction,
  editFaqAction,
  generateSummaryDraftAction,
  markReviewedAction,
  removeAlternativeAction,
  removeFaqAction,
  removeVariantAction,
  saveTranslationAction,
  translatePartAction,
  setAlternativeVerifiedAction,
  setFaqPublishedAction,
  setStatusAction,
  updatePartAction,
} from "@/app/admin/parts/actions";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  Card,
  Field,
  first,
  IndexableBadge,
  inputCls,
  LIFECYCLE_LABEL,
  Notice,
  RELATION_LABEL,
  StatusBadge,
  ymd,
} from "@/components/admin/ui";
import { ManufacturerFactsPanel } from "@/components/admin/manufacturer-facts-panel";
import type { PageStatus } from "@/generated/prisma/enums";
import { faqPublishable } from "@/lib/inquiry/to-faq";
import { sourceForManufacturer } from "@/lib/manufacturer/registry";
import { findUnsupportedNumbers } from "@/lib/parts/summary-draft";
import { summaryDraftEnabled } from "@/lib/parts/summary-draft-llm";
import { translationEnabled } from "@/lib/parts/translate-llm";
import { translationStatus } from "@/lib/parts/translations";
import { localePath, type Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { getQuality } from "@/lib/parts/admin";
import { partPath } from "@/lib/parts/resolve-route";
import { charCount } from "@/lib/parts/quality";
import { formatKeySpecs, LIFECYCLE_VALUES } from "@/lib/parts/validate-part";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function EditPartPage(props: PageProps<"/admin/parts/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!UUID_RE.test(id)) notFound();

  const [part, categories, quality, trStatus, translations] = await Promise.all([
    db().part.findUnique({
      where: { id },
      include: {
        manufacturer: { select: { slug: true, nameEn: true, nameKo: true } },
        slugs: { orderBy: { createdAt: "desc" }, select: { slug: true, isCanonical: true } },
        variants: { orderBy: { mpnVariant: "asc" } },
        alternatives: {
          orderBy: { createdAt: "asc" },
          include: { altPart: { select: { mpnDisplay: true, manufacturer: { select: { nameEn: true } } } } },
        },
        faqs: { orderBy: { createdAt: "asc" } },
      },
    }),
    db().category.findMany({ orderBy: { nameKo: "asc" }, select: { id: true, nameKo: true } }),
    getQuality(id).catch(() => null),
    translationStatus(id).catch(() => null),
    db().partTranslation.findMany({ where: { partId: id }, select: { locale: true, summary: true, faqs: true } }),
  ]);
  if (part == null || quality == null) notFound();

  const canonical = part.slugs.find((s) => s.isCanonical)?.slug ?? "";
  const publicPath = partPath(part.manufacturer.slug, canonical);
  const editedAfterReview = part.reviewedAt != null && part.contentUpdatedAt > part.reviewedAt;
  const summaryLen = part.summaryKo ? charCount(part.summaryKo.trim()) : 0;
  const draftEnabled = summaryDraftEnabled();
  const draftWarnings = part.summaryDraftKo
    ? findUnsupportedNumbers(part.summaryDraftKo, {
        mpn: part.mpnDisplay,
        manufacturer: part.manufacturer.nameEn,
        category: categories.find((c) => c.id === part.categoryId)?.nameKo ?? null,
        package: part.package,
        keySpecs: Array.isArray(part.keySpecs) ? (part.keySpecs as { label: string; value: string }[]) : [],
        lifecycle: part.lifecycleStatus,
        lifecycleCheckedAt: part.lifecycleCheckedAt,
        eolDate: part.eolDate,
        verifiedAlternatives: part.alternatives
          .filter((a) => a.verified)
          .map((a) => ({ mpn: a.altPart?.mpnDisplay ?? a.altMpnText ?? "", relation: a.relation })),
      })
    : [];

  const transitions: { to: PageStatus; label: string }[] = (
    [
      { to: "review", label: "검토 요청" },
      { to: "published", label: "게시" },
      { to: "unpublished", label: "비게시 (410)" },
      { to: "draft", label: "초안으로" },
    ] as const
  ).filter((t) => t.to !== part.pageStatus);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link href="/admin/parts" className="hover:underline">
              부품
            </Link>{" "}
            / {part.manufacturer.nameEn}
          </p>
          <h1 className="mpn text-2xl font-bold">{part.mpnDisplay}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={part.pageStatus} />
            <IndexableBadge indexable={quality.indexable} />
            <span className="mpn text-xs text-muted">{publicPath}</span>
            <Link href={`/admin/parts/${part.id}/preview`} className="text-xs text-brand-600 hover:underline dark:text-brand-300">
              미리보기
            </Link>
            {part.pageStatus === "published" && (
              <a href={publicPath} target="_blank" className="text-xs text-brand-600 hover:underline dark:text-brand-300">
                공개 페이지 ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <Notice error={first(sp.error)} message={first(sp.message) || (first(sp.saved) ? "저장했습니다." : undefined)} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── 기본 정보 ── */}
        <form action={updatePartAction.bind(null, part.id)} className="space-y-4 lg:col-span-2">
          <Card title="기본 정보" actions={<button className={btnPrimary}>저장</button>}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="품번 (원본 표기)" hint="바꾸면 이전 URL은 새 URL로 301 이동합니다.">
                <input name="mpnDisplay" defaultValue={part.mpnDisplay} className={`${inputCls} mpn`} />
              </Field>
              <Field label="제조사">
                <input disabled value={`${part.manufacturer.nameEn} (${part.manufacturer.nameKo})`} className={`${inputCls} opacity-70`} />
              </Field>
              <Field label="카테고리">
                <select name="categoryId" defaultValue={part.categoryId ?? ""} className={inputCls}>
                  <option value="">선택 안 함</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameKo}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="패키지">
                <input name="package" defaultValue={part.package ?? ""} className={inputCls} />
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field
                label={`한국어 요약 (현재 ${summaryLen}자)`}
                hint="무엇인지, 수명주기 상태, 대체품 여부를 기준일과 함께 사실 문장으로. 유통사·데이터시트 문장 복사 금지."
              >
                <textarea name="summaryKo" rows={4} defaultValue={part.summaryKo ?? ""} className={inputCls} />
              </Field>
              <Field label="주요 스펙" hint="한 줄에 하나씩 '항목: 값' 형식. 예) 공급 전압: 3~32 V">
                <textarea name="keySpecs" rows={5} defaultValue={formatKeySpecs(part.keySpecs)} className={`${inputCls} mpn`} />
              </Field>
              <Field label="데이터시트 URL" hint="제조사 공식 https 주소만">
                <input name="datasheetUrl" type="url" defaultValue={part.datasheetUrl ?? ""} className={inputCls} />
              </Field>
            </div>
          </Card>

          <Card title="수명주기">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="상태">
                <select name="lifecycleStatus" defaultValue={part.lifecycleStatus} className={inputCls}>
                  {LIFECYCLE_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {LIFECYCLE_LABEL[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="확인일">
                <input name="lifecycleCheckedAt" type="date" defaultValue={ymd(part.lifecycleCheckedAt)} className={inputCls} />
              </Field>
              <Field label="단종일 (EOL)">
                <input name="eolDate" type="date" defaultValue={ymd(part.eolDate)} className={inputCls} />
              </Field>
              <Field label="출처" hint="예: 제조사 PCN 번호, 제조사 상품 페이지 URL">
                <input name="lifecycleSource" defaultValue={part.lifecycleSource ?? ""} className={inputCls} />
              </Field>
            </div>
          </Card>
        </form>

        {/* ── 품질·상태 ── */}
        <div className="space-y-4">
          <Card title="색인 품질 체크리스트">
            <ul className="space-y-2 text-sm">
              {quality.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span
                    aria-label={c.ok ? "충족" : "미충족"}
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${c.ok ? "bg-pcb-500" : "bg-zinc-400"}`}
                  >
                    {c.ok ? "✓" : "–"}
                  </span>
                  <span>
                    {c.label}
                    <span className="block text-xs text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="요약 초안 (AI)">
            <div className="space-y-2 text-sm">
              {part.summaryDraftKo ? (
                <>
                  {draftWarnings.length > 0 && (
                    <p className="rounded bg-copper-50 p-2 text-xs text-copper-700 dark:bg-copper-700/20 dark:text-copper-200">
                      입력하지 않은 숫자: {draftWarnings.join(", ")} — 사실이 아니면 고치거나 지우세요.
                    </p>
                  )}
                  <form action={applySummaryDraftAction.bind(null, part.id)} className="space-y-2">
                    <textarea name="draft" rows={5} defaultValue={part.summaryDraftKo} className={inputCls} />
                    <p className="text-xs text-muted">입력한 사실만 근거로 만든 초안입니다. 고친 뒤 적용하면 요약 칸을 대체합니다.</p>
                    <button className={btnPrimary}>요약에 적용</button>
                  </form>
                  <form action={discardSummaryDraftAction.bind(null, part.id)}>
                    <button className={btnDanger}>초안 버리기</button>
                  </form>
                </>
              ) : (
                <p className="text-xs text-muted">제조사·스펙·수명주기·검증된 대체품 등 입력한 사실만으로 2~3문장 초안을 만듭니다.</p>
              )}
              <form action={generateSummaryDraftAction.bind(null, part.id)}>
                <button className={btnSecondary} disabled={!draftEnabled}>
                  {part.summaryDraftKo ? "초안 다시 만들기" : "요약 초안 만들기"}
                </button>
              </form>
              {!draftEnabled && <p className="text-xs text-muted">꺼져 있음: SUMMARY_DRAFT_ENABLED=true 와 ANTHROPIC_API_KEY 필요</p>}
            </div>
          </Card>

          <Card title="번역 (영어·일본어·스페인어)">
            <div className="space-y-3 text-sm">
              {trStatus && (
                <ul className="space-y-1">
                  {(Object.entries(trStatus) as [Locale, { status: string; method: string | null; updatedAt: Date | null }][]).map(([l, st]) => (
                    <li key={l} className="flex flex-wrap items-center gap-2">
                      <span className="w-8 font-semibold uppercase">{l}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${st.status === "current" ? "bg-pcb-50 text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100" : st.status === "stale" ? "bg-copper-50 text-copper-700 dark:bg-copper-700/20 dark:text-copper-200" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                      >
                        {st.status === "current" ? "최신" : st.status === "stale" ? "원문 변경됨" : "없음"}
                      </span>
                      {st.method === "manual" && <span className="text-xs text-muted">직접 수정</span>}
                      {part.pageStatus === "published" && st.status !== "missing" && (
                        <a href={localePath(l, publicPath)} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline dark:text-brand-300">
                          보기
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">요약·스펙·FAQ·대체품 비고를 번역합니다. 번역이 없는 언어의 부품 페이지는 한국어로 표시되고 검색엔진에 색인되지 않습니다.</p>
              <form action={translatePartAction.bind(null, part.id)}>
                <button className={btnSecondary} disabled={!translationEnabled()}>
                  {translations.length > 0 ? "번역 다시 만들기" : "번역 만들기"}
                </button>
              </form>
              {!translationEnabled() && <p className="text-xs text-muted">꺼져 있음: TRANSLATION_ENABLED=true 와 ANTHROPIC_API_KEY 필요</p>}
              {translations.map((tr) => {
                const faqs = Array.isArray(tr.faqs) ? (tr.faqs as { q: string; a: string }[]) : [];
                return (
                  <details key={tr.locale} className="rounded-md border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase">{tr.locale} 번역 고치기</summary>
                    <form action={saveTranslationAction.bind(null, part.id, tr.locale)} className="space-y-2 border-t border-line p-3">
                      <textarea name="summary" rows={4} defaultValue={tr.summary ?? ""} className={inputCls} aria-label={`${tr.locale} 요약`} />
                      {faqs.map((f, i) => (
                        <div key={i} className="space-y-1">
                          <input name={`q${i}`} defaultValue={f.q} className={inputCls} aria-label={`${tr.locale} FAQ ${i + 1} 질문`} />
                          <textarea name={`a${i}`} rows={2} defaultValue={f.a} className={inputCls} aria-label={`${tr.locale} FAQ ${i + 1} 답변`} />
                        </div>
                      ))}
                      <button className={btnPrimary}>저장 (직접 수정으로 표시)</button>
                    </form>
                  </details>
                );
              })}
            </div>
          </Card>

          <Card title="제조사 공식 정보">
            <ManufacturerFactsPanel partId={part.id} supported={sourceForManufacturer(part.manufacturer.slug) != null} />
          </Card>

          <Card title="검토·게시">
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                {part.reviewedBy ? `검토: ${part.reviewedBy} (${ymd(part.reviewedAt)})` : "아직 검토 전입니다."}
              </p>
              {editedAfterReview && (
                <p className="rounded bg-copper-50 p-2 text-xs text-copper-700 dark:bg-copper-700/20 dark:text-copper-200">
                  검토 이후 내용이 수정되었습니다. 다시 검토해 주세요.
                </p>
              )}
              <form action={markReviewedAction.bind(null, part.id)}>
                <button className={btnSecondary}>검토 완료로 기록</button>
              </form>
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                  <form key={t.to} action={setStatusAction.bind(null, part.id, t.to)}>
                    <button className={t.to === "published" ? btnPrimary : btnSecondary}>{t.label}</button>
                  </form>
                ))}
              </div>
              <p className="text-xs text-muted">게시해도 체크리스트를 모두 충족해야 색인됩니다. 비게시로 바꾸면 공개 URL은 410을 응답합니다.</p>
            </div>
          </Card>

          <Card title="URL 이력">
            <ul className="mpn space-y-1 text-xs">
              {part.slugs.map((s) => (
                <li key={s.slug} className={s.isCanonical ? "font-semibold" : "text-muted"}>
                  {s.slug} {s.isCanonical ? "(정규)" : "→ 301"}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* ── 대체품 ── */}
      <Card title={`대체품 (검증 ${part.alternatives.filter((a) => a.verified).length} / ${part.alternatives.length})`}>
        {part.alternatives.length > 0 && (
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">대체 품번</th>
                <th className="py-1 font-medium">관계</th>
                <th className="py-1 font-medium">비고</th>
                <th className="py-1 font-medium">검증</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {part.alternatives.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="mpn py-2">
                    {a.altPart ? `${a.altPart.mpnDisplay} (${a.altPart.manufacturer.nameEn}, 내부 페이지)` : a.altMpnText}
                  </td>
                  <td className="py-2">{RELATION_LABEL[a.relation]}</td>
                  <td className="py-2 text-muted">{a.noteKo ?? ""}</td>
                  <td className="py-2">
                    <form action={setAlternativeVerifiedAction.bind(null, part.id, a.id, !a.verified)}>
                      <button className={btnSecondary}>{a.verified ? `검증됨 (${a.verifiedBy})` : "미검증 → 검증"}</button>
                    </form>
                  </td>
                  <td className="py-2 text-right">
                    <form action={removeAlternativeAction.bind(null, part.id, a.id)}>
                      <button className={btnDanger}>삭제</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addAlternativeAction.bind(null, part.id)} className="grid gap-2 sm:grid-cols-[1fr_140px_1fr_auto]">
          <input name="altMpn" placeholder="대체 품번" required className={`${inputCls} mpn`} />
          <select name="relation" className={inputCls}>
            {Object.entries(RELATION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input name="noteKo" placeholder="비고 (예: 핀 배치 동일, 온도 범위 상이)" className={inputCls} />
          <button className={btnSecondary}>추가</button>
        </form>
      </Card>

      {/* ── FAQ ── */}
      <div id="faq" />
      <Card title={`FAQ (게시 ${part.faqs.filter((f) => f.published).length} / ${part.faqs.length})`}>
        <p className="mb-3 text-xs text-muted">
          실제 문의에서 나온 질문이나 관리자가 직접 쓴 질문만 넣습니다. 템플릿으로 찍어 낸 FAQ는 금지입니다. 문의 내용의 개인정보는 옮기지 마세요.
        </p>
        <ul className="mb-4 space-y-3">
          {part.faqs.map((f) => (
            <li key={f.id} className="rounded-md border border-line p-3 text-sm">
              <p className="font-medium">Q. {f.questionKo}</p>
              <p className="mt-1 text-muted">A. {f.answerKo}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-brand-600 dark:text-brand-300">질문·답변 수정</summary>
                <form action={editFaqAction.bind(null, part.id, f.id)} className="mt-2 space-y-2">
                  <input name="questionKo" defaultValue={f.questionKo} required className={inputCls} />
                  <textarea name="answerKo" defaultValue={f.answerKo} rows={3} required className={inputCls} />
                  <button className={btnSecondary}>저장</button>
                </form>
              </details>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted">{f.source === "inquiry" ? "문의에서 전환" : "관리자 작성"}</span>
                {!f.published && !faqPublishable(f.answerKo) ? (
                  <span className="text-xs text-copper-700 dark:text-copper-200">답변을 작성해야 게시할 수 있습니다</span>
                ) : (
                  <form action={setFaqPublishedAction.bind(null, part.id, f.id, !f.published)}>
                    <button className={btnSecondary}>{f.published ? "게시됨 → 내리기" : "게시하기"}</button>
                  </form>
                )}
                <form action={removeFaqAction.bind(null, part.id, f.id)}>
                  <button className={btnDanger}>삭제</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form action={addFaqAction.bind(null, part.id)} className="space-y-2">
          <input name="questionKo" placeholder="질문" required className={inputCls} />
          <textarea name="answerKo" placeholder="답변" rows={3} required className={inputCls} />
          <button className={btnSecondary}>FAQ 추가 (미게시로 저장)</button>
        </form>
      </Card>

      {/* ── 변형 품번 ── */}
      <Card title={`변형 품번 (${part.variants.length})`}>
        <p className="mb-3 text-xs text-muted">릴·테이프 접미사 등. 별도 페이지 없이 이 부품 URL로 301 이동합니다.</p>
        <ul className="mb-3 flex flex-wrap gap-2">
          {part.variants.map((v) => (
            <li key={v.id} className="mpn flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs">
              {v.mpnVariant}
              <form action={removeVariantAction.bind(null, part.id, v.id)}>
                <button className="text-red-600" aria-label={`${v.mpnVariant} 삭제`}>
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addVariantAction.bind(null, part.id)} className="flex gap-2">
          <input name="mpnVariant" placeholder="예: AD8221ARZ-R7" required className={`${inputCls} mpn max-w-xs`} />
          <button className={btnSecondary}>추가</button>
        </form>
      </Card>
    </div>
  );
}
