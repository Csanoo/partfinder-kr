import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addAlternativeAction,
  addFaqAction,
  addVariantAction,
  markReviewedAction,
  removeAlternativeAction,
  removeFaqAction,
  removeVariantAction,
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
import type { PageStatus } from "@/generated/prisma/enums";
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

  const [part, categories, quality] = await Promise.all([
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
  ]);
  if (part == null || quality == null) notFound();

  const canonical = part.slugs.find((s) => s.isCanonical)?.slug ?? "";
  const publicPath = partPath(part.manufacturer.slug, canonical);
  const editedAfterReview = part.reviewedAt != null && part.contentUpdatedAt > part.reviewedAt;
  const summaryLen = part.summaryKo ? charCount(part.summaryKo.trim()) : 0;

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

      <Notice error={first(sp.error)} message={first(sp.saved) ? "저장했습니다." : undefined} />

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
      <Card title={`FAQ (게시 ${part.faqs.filter((f) => f.published).length} / ${part.faqs.length})`}>
        <p className="mb-3 text-xs text-muted">
          실제 문의에서 나온 질문이나 관리자가 직접 쓴 질문만 넣습니다. 템플릿으로 찍어 낸 FAQ는 금지입니다. 문의 내용의 개인정보는 옮기지 마세요.
        </p>
        <ul className="mb-4 space-y-3">
          {part.faqs.map((f) => (
            <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="font-medium">Q. {f.questionKo}</p>
              <p className="mt-1 text-muted">A. {f.answerKo}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted">{f.source === "inquiry" ? "문의에서 전환" : "관리자 작성"}</span>
                <form action={setFaqPublishedAction.bind(null, part.id, f.id, !f.published)}>
                  <button className={btnSecondary}>{f.published ? "게시됨 → 내리기" : "게시하기"}</button>
                </form>
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
