import Link from "next/link";
import type { ReactNode } from "react";
import { PackageFigure } from "@/components/package-illustration";
import { parsePackage } from "@/lib/package/parse-package";
import { manufacturerLabel, ymd, type PartPageModel } from "@/lib/parts/page-model";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";

const lifecycleTone: Record<PartPageModel["lifecycle"]["status"], string> = {
  active: "bg-pcb-50 text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100",
  nrnd: "bg-copper-100 text-copper-700 dark:bg-copper-700/25 dark:text-copper-200",
  ltb: "bg-copper-100 text-copper-700 dark:bg-copper-700/25 dark:text-copper-200",
  eol: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  unknown: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-md border border-line bg-surface p-4 sm:p-5">
      <h2 id={id} className="mb-3 text-base font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * 부품 상세 화면 (SEO_SPEC 5.1 순서).
 * 재고 영역과 소싱 문의 폼은 클라이언트·서버 액션 의존성이 있어 슬롯으로 받는다.
 */
export function PartDetail({
  part,
  availability,
  sourcingForm,
  locale = DEFAULT_LOCALE,
}: {
  part: PartPageModel;
  availability: ReactNode;
  sourcingForm: ReactNode;
  locale?: Locale;
}) {
  const d = getDictionary(locale);
  const t = d.part;
  const lp = (p: string) => localePath(locale, p);
  const pkg = parsePackage(part.package);
  const lc = part.lifecycle;

  return (
    <article className="space-y-5">
      {/* 경로 */}
      <nav aria-label={d.common.breadcrumb} className="text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={lp("/")} className="hover:underline">
              {d.common.home}
            </Link>
          </li>
          {part.category && (
            <li>
              /{" "}
              <Link href={lp(`/categories/${part.category.slug}`)} className="hover:underline">
                {part.category.nameKo}
              </Link>
            </li>
          )}
          <li>
            /{" "}
            <Link href={lp(`/manufacturers/${part.manufacturer.slug}`)} className="hover:underline">
              {part.manufacturer.nameEn}
            </Link>
          </li>
          <li aria-current="page">/ {part.mpnDisplay}</li>
        </ol>
      </nav>

      {/* 1. H1 + 2. 핵심 요약 */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {pkg.family !== "unknown" && <PackageFigure info={pkg} size={112} locale={locale} />}
        <div className="min-w-0 space-y-3">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            <span className="mpn break-all">{part.mpnDisplay}</span>
            <span className="mt-1 block text-lg font-medium text-muted">{manufacturerLabel(part.manufacturer)}</span>
          </h1>
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${lifecycleTone[lc.status]}`}>
            {t.lifecycleText[lc.status]}
          </span>
          {part.summaryKo && (
            <p className="text-base leading-relaxed" lang={part.translation === "missing" ? "ko" : undefined}>
              {part.summaryKo}
            </p>
          )}
          {part.translation === "missing" && <p className="text-xs text-muted">{t.notTranslated}</p>}
          {part.translation === "machine" && <p className="text-xs text-muted">{t.machineTranslated}</p>}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* 3. 기본 정보 */}
          <Section id="info-heading" title={t.info}>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-line">
                  <th className="w-36 py-2 text-left font-medium text-muted">{t.manufacturer}</th>
                  <td className="py-2">{manufacturerLabel(part.manufacturer)}</td>
                </tr>
                {part.category && (
                  <tr className="border-b border-line">
                    <th className="py-2 text-left font-medium text-muted">{t.category}</th>
                    <td className="py-2">{part.category.nameKo}</td>
                  </tr>
                )}
                {part.package && (
                  <tr className="border-b border-line">
                    <th className="py-2 text-left font-medium text-muted">{t.package}</th>
                    <td className="mpn py-2">{part.package}</td>
                  </tr>
                )}
                {part.keySpecs.map((s) => (
                  <tr key={s.label} className="border-b border-line">
                    <th className="py-2 text-left font-medium text-muted">{s.label}</th>
                    <td className="py-2">{s.value}</td>
                  </tr>
                ))}
                {part.datasheetUrl && (
                  <tr>
                    <th className="py-2 text-left font-medium text-muted">{t.datasheet}</th>
                    <td className="py-2">
                      <a href={part.datasheetUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-300">
                        {t.datasheetLink}
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          {/* 4. 수명주기 */}
          <Section id="lifecycle-heading" title={t.lifecycle}>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">{t.status}</dt>
              <dd className="font-semibold">{t.lifecycleText[lc.status]}</dd>
              {lc.eolDate && (
                <>
                  <dt className="text-muted">{t.eolDate}</dt>
                  <dd>{ymd(lc.eolDate)}</dd>
                </>
              )}
              <dt className="text-muted">{t.checkedAt}</dt>
              <dd>{lc.checkedAt ? ymd(lc.checkedAt) : "-"}</dd>
              {lc.source && (
                <>
                  <dt className="text-muted">{t.source}</dt>
                  <dd className="break-words">{lc.source}</dd>
                </>
              )}
            </dl>
          </Section>

          {/* 5. 대체품 */}
          <Section id="alt-heading" title={fmt(t.alternatives, { n: part.alternatives.length })}>
            {part.alternatives.length === 0 ? (
              <p className="text-sm text-muted">{t.altNone}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1.5 font-medium">{t.altMpn}</th>
                      <th className="py-1.5 font-medium">{t.altRelation}</th>
                      <th className="py-1.5 font-medium">{t.altNote}</th>
                      <th className="py-1.5 font-medium">{t.altVerified}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.alternatives.map((a) => (
                      <tr key={`${a.mpn}-${a.relation}`} className="border-t border-line">
                        <td className="py-2">
                          {a.path ? (
                            <Link href={lp(a.path)} className="mpn font-medium text-brand-600 hover:underline dark:text-brand-300">
                              {a.mpn}
                            </Link>
                          ) : (
                            <span className="mpn font-medium">{a.mpn}</span>
                          )}
                          {a.manufacturerName && <span className="block text-xs text-muted">{a.manufacturerName}</span>}
                        </td>
                        <td className="py-2">{t.relationText[a.relation]}</td>
                        <td className="py-2 text-muted">{a.noteKo ?? ""}</td>
                        <td className="py-2">
                          {a.verified ? (
                            <span className="rounded-full bg-pcb-50 px-2 py-0.5 text-xs font-semibold text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100">{t.verified}</span>
                          ) : (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t.unverified}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 6. 정식 유통사 재고 (클라이언트 측) */}
          <Section id="availability-heading" title={t.stock}>
            {availability}
          </Section>

          {/* 8. FAQ */}
          {part.faqs.length > 0 && (
            <Section id="faq-heading" title={t.faq}>
              <dl className="space-y-4">
                {part.faqs.map((f) => (
                  <div key={f.questionKo}>
                    <dt className="font-semibold">{f.questionKo}</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed">{f.answerKo}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {/* 9. 관련 부품 */}
          {part.related.length > 0 && (
            <Section id="related-heading" title={t.related}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {part.related.map((r) => (
                  <li key={r.path}>
                    <Link href={lp(r.path)} className="block rounded-md border border-line px-3 py-2 hover:border-brand-400">
                      <span className="mpn font-medium">{r.mpn}</span>
                      <span className="block text-xs text-muted">{r.manufacturerName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* 7. 부품 요청 (시각적으로 분리) */}
        <aside aria-labelledby="sourcing-heading" className="h-fit space-y-3 rounded-md border border-brand-600 bg-surface p-5 lg:sticky lg:top-20 dark:border-brand-400">
          <h2 id="sourcing-heading" className="text-lg font-bold">
            {t.requestTitle}
          </h2>
          <p className="text-sm text-muted">{t.requestLead}</p>
          <p className="text-xs text-muted">{d.common.sourcingDisclaimer}</p>
          {sourcingForm}
        </aside>
      </div>

      {/* 10. 운영 주체 고지 */}
    </article>
  );
}
