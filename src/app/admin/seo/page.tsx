import Link from "next/link";
import { Card, first } from "@/components/admin/ui";
import { Kpi, PeriodTabs } from "@/components/admin/period-tabs";
import { TRAFFIC_LABEL, type TrafficSource } from "@/lib/attribution";
import { parsePeriod, pct, recordIndexSnapshot, seoMetrics } from "@/lib/metrics";

/** SEO 지표 (docs/SEO_SPEC.md 8장) */
export default async function SeoMetricsPage(props: PageProps<"/admin/seo">) {
  const days = parsePeriod(first((await props.searchParams).days));
  await recordIndexSnapshot().catch(() => undefined);
  const m = await seoMetrics(days);
  const totalBySource = m.inquiriesBySource.reduce((s, x) => s + x.count, 0);
  const latest = m.snapshots.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">부품 페이지·유입 지표</h1>
        <PeriodTabs base="/admin/seo" days={days} />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="부품 페이지 조회" value={(m.events.part_view ?? 0).toLocaleString("ko-KR")} hint="봇 제외" />
        <Kpi label="재고 영역 조회" value={(m.events.availability_view ?? 0).toLocaleString("ko-KR")} />
        <Kpi label="소싱 폼 열기" value={(m.events.sourcing_form_open ?? 0).toLocaleString("ko-KR")} />
        <Kpi label="문의 제출" value={(m.events.inquiry_submit ?? 0).toLocaleString("ko-KR")} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="유입 경로별 문의">
          <table className="w-full text-sm">
            <tbody>
              {m.inquiriesBySource.map((s) => (
                <tr key={s.source} className="border-b border-line last:border-0">
                  <td className="py-1.5">{s.source === "unknown" ? "기록 없음" : TRAFFIC_LABEL[s.source as TrafficSource]}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.count}</td>
                  <td className="w-16 py-1.5 text-right text-xs tabular-nums text-muted">{pct(totalBySource ? s.count / totalBySource : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="색인 가능 페이지 수 추이 (일별)">
          {m.snapshots.length === 0 ? (
            <p className="text-sm text-muted">기록이 없습니다.</p>
          ) : (
            <>
              <p className="mb-2 text-sm">
                현재 색인 가능 <b className="tabular-nums">{latest?.indexableParts ?? 0}</b> / 게시 {latest?.publishedParts ?? 0}
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-medium">날짜</th>
                    <th className="py-1 text-right font-medium">게시</th>
                    <th className="py-1 text-right font-medium">색인 가능</th>
                  </tr>
                </thead>
                <tbody>
                  {[...m.snapshots].reverse().map((s) => (
                    <tr key={s.day.toISOString()} className="border-t border-line">
                      <td className="py-1">{s.day.toISOString().slice(0, 10)}</td>
                      <td className="py-1 text-right tabular-nums">{s.publishedParts}</td>
                      <td className="py-1 text-right tabular-nums">{s.indexableParts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>

      <Card title="부품 페이지별 (문의 많은 순, 상위 50)">
        {m.perPart.length === 0 ? (
          <p className="text-sm text-muted">기간 안에 조회나 문의가 있는 부품 페이지가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 font-medium">품번</th>
                  <th className="py-1.5 text-right font-medium">조회</th>
                  <th className="py-1.5 text-right font-medium">재고 조회</th>
                  <th className="py-1.5 text-right font-medium">폼 열기</th>
                  <th className="py-1.5 text-right font-medium">문의</th>
                  <th className="py-1.5 text-right font-medium">전환율</th>
                </tr>
              </thead>
              <tbody>
                {m.perPart.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-1.5">
                      <Link href={`/admin/parts/${p.id}`} className="mpn text-brand-700 hover:underline dark:text-brand-300">
                        {p.mpn}
                      </Link>
                      <span className="ml-1 text-xs text-muted">{p.manufacturer}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{p.views}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.availabilityViews}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.formOpens}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{p.inquiries}</td>
                    <td className="py-1.5 text-right tabular-nums">{pct(p.conversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted">Search Console 연동은 다음 단계 (지금은 Search Console·서치어드바이저에서 직접 확인).</p>
    </div>
  );
}
