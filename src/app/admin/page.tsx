import Link from "next/link";
import { Card, first } from "@/components/admin/ui";
import { INQUIRY_STATUS_LABEL, INQUIRY_TYPE_LABEL } from "@/components/admin/labels";
import { Kpi, PeriodTabs } from "@/components/admin/period-tabs";
import { mvpMetrics, parsePeriod, pct, recordIndexSnapshot } from "@/lib/metrics";

/** 관리자 대시보드 (docs/SPEC.md 8장 지표) */
export default async function AdminDashboard(props: PageProps<"/admin">) {
  const days = parsePeriod(first((await props.searchParams).days));
  const [m] = await Promise.all([mvpMetrics(days), recordIndexSnapshot().catch(() => undefined)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">대시보드</h1>
        <PeriodTabs base="/admin" days={days} />
      </div>

      <Link
        href="/admin/inquiries?status=new"
        className={`flex items-center justify-between rounded-md border p-4 ${m.newCount > 0 ? "border-copper-400 bg-copper-50 dark:bg-copper-700/15" : "border-line bg-surface"}`}
      >
        <span className="font-semibold">신규 문의</span>
        <span className="text-2xl font-bold tabular-nums">{m.newCount}건 →</span>
      </Link>
      {m.notifyFailed > 0 && (
        <Link href="/admin/inquiries?notify=failed" className="block rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          알림 메일 발송 실패 {m.notifyFailed}건 확인하기 →
        </Link>
      )}

      <section aria-label="수요 지표" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="검색 수" value={m.searches.toLocaleString("ko-KR")} hint="봇 제외" />
        <Kpi label="결과 없음 비율" value={pct(m.noResultRate)} hint={`${m.noResultCount}건 (모든 소스 결과 0 또는 조회 불가)`} />
        <Kpi label="문의 수" value={m.inquiries.toLocaleString("ko-KR")} />
        <Kpi label="문의 전환율" value={pct(m.conversion)} hint="문의 수 ÷ 검색 수" />
        <Kpi label="11개 이상 + 회사 비율" value={pct(m.bomCompanyRate)} hint={`문의 중 ${m.bomCompanyCount}건 (BOM 수요 신호)`} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="문의 종류별">
          <ul className="space-y-1 text-sm">
            {Object.entries(INQUIRY_TYPE_LABEL).map(([k, label]) => (
              <li key={k} className="flex justify-between">
                <span>{label}</span>
                <span className="tabular-nums">{m.byType[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="문의 상태별">
          <ul className="space-y-1 text-sm">
            {Object.entries(INQUIRY_STATUS_LABEL).map(([k, label]) => (
              <li key={k} className="flex justify-between">
                <Link href={`/admin/inquiries?status=${k}`} className="hover:underline">
                  {label}
                </Link>
                <span className="tabular-nums">{m.byStatus[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-sm">
        <Link href={`/admin/seo?days=${days}`} className="text-brand-600 hover:underline dark:text-brand-300">
          부품 페이지·유입 경로 지표 보기 →
        </Link>
      </p>
    </div>
  );
}
