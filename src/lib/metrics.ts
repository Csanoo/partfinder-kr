import { db } from "@/lib/db";
import type { TrafficSource } from "@/lib/attribution";
import { monthsAgo, qualityConfig } from "@/lib/parts/quality";

/** 기간 선택: 7·30·90일 (기본 30) */
export const PERIODS = [7, 30, 90] as const;
export function parsePeriod(raw: string | undefined): (typeof PERIODS)[number] {
  const n = Number(raw);
  return (PERIODS as readonly number[]).includes(n) ? (n as (typeof PERIODS)[number]) : 30;
}

export const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
export const pct = (r: number | null) => (r == null ? "-" : `${(r * 100).toFixed(1)}%`);

/** MVP 지표 (docs/SPEC.md 8장) */
export async function mvpMetrics(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const inPeriod = { createdAt: { gte: since } };

  const [searches, noResult, inquiries, bomCompany, byType, byStatus, newCount, notifyFailed] = await Promise.all([
    db().searchLog.count({ where: inPeriod }),
    // 결과 없음: 모든 소스의 결과 수가 0 또는 조회 불가
    db().$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM search_log s
      WHERE s.created_at >= ${since}
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(s.result_count_by_provider) e
          WHERE e.value ~ '^[0-9]+$' AND e.value::int > 0
        )`,
    db().inquiry.count({ where: inPeriod }),
    db().inquiry.count({ where: { ...inPeriod, itemCountBucket: "eleven_plus", purchaseType: "company" } }),
    db().inquiry.groupBy({ by: ["type"], where: inPeriod, _count: { _all: true } }),
    db().inquiry.groupBy({ by: ["status"], where: inPeriod, _count: { _all: true } }),
    db().inquiry.count({ where: { status: "new" } }),
    db().inquiry.count({ where: { notifyStatus: "failed" } }),
  ]);
  const noResultCount = Number(noResult[0]?.n ?? 0);

  return {
    days,
    searches,
    noResultCount,
    noResultRate: ratio(noResultCount, searches),
    inquiries,
    conversion: ratio(inquiries, searches),
    bomCompanyCount: bomCompany,
    bomCompanyRate: ratio(bomCompany, inquiries),
    byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])) as Record<string, number>,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>,
    newCount,
    notifyFailed,
  };
}

/** 오늘 색인 가능 페이지 수 기록 (하루 1건, 다시 부르면 갱신) */
export async function recordIndexSnapshot(now = new Date()) {
  const staleBefore = monthsAgo(now, qualityConfig().lifecycleMaxAgeMonths);
  const [published, indexable] = await Promise.all([
    db().part.count({ where: { pageStatus: "published" } }),
    db().part.count({ where: { pageStatus: "published", indexable: true, lifecycleCheckedAt: { gte: staleBefore, lte: now } } }),
  ]);
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await db().indexSnapshot.upsert({
    where: { day },
    create: { day, publishedParts: published, indexableParts: indexable },
    update: { publishedParts: published, indexableParts: indexable },
  });
}

/** SEO 지표 (docs/SEO_SPEC.md 8장) */
export async function seoMetrics(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);

  const [views, avail, formOpens, partInquiries, bySource, eventCounts, snapshots] = await Promise.all([
    db().event.groupBy({ by: ["partId"], where: { type: "part_view", createdAt: { gte: since }, partId: { not: null } }, _count: { _all: true } }),
    db().event.groupBy({ by: ["partId"], where: { type: "availability_view", createdAt: { gte: since }, partId: { not: null } }, _count: { _all: true } }),
    db().event.groupBy({ by: ["partId"], where: { type: "sourcing_form_open", createdAt: { gte: since }, partId: { not: null } }, _count: { _all: true } }),
    db().inquiry.groupBy({ by: ["partId"], where: { createdAt: { gte: since }, partId: { not: null } }, _count: { _all: true } }),
    db().inquiry.groupBy({ by: ["trafficSource"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db().event.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db().indexSnapshot.findMany({ orderBy: { day: "desc" }, take: 30 }),
  ]);

  const partIds = [...new Set([...views, ...partInquiries].map((r) => r.partId!))];
  const parts = await db().part.findMany({
    where: { id: { in: partIds } },
    select: { id: true, mpnDisplay: true, manufacturer: { select: { nameEn: true } } },
  });
  const count = (rows: { partId: string | null; _count: { _all: number } }[], id: string) => rows.find((r) => r.partId === id)?._count._all ?? 0;

  const perPart = parts
    .map((p) => {
      const v = count(views, p.id);
      const q = count(partInquiries, p.id);
      return {
        id: p.id,
        mpn: p.mpnDisplay,
        manufacturer: p.manufacturer.nameEn,
        views: v,
        availabilityViews: count(avail, p.id),
        formOpens: count(formOpens, p.id),
        inquiries: q,
        conversion: ratio(q, v),
      };
    })
    .sort((a, b) => b.inquiries - a.inquiries || b.views - a.views)
    .slice(0, 50);

  const sources: (TrafficSource | "unknown")[] = ["google", "naver", "ai", "other_search", "referral", "direct", "unknown"];
  const inquiriesBySource = sources.map((s) => ({
    source: s,
    count: bySource.find((b) => (b.trafficSource ?? "unknown") === s)?._count._all ?? 0,
  }));

  return {
    days,
    perPart,
    inquiriesBySource,
    events: Object.fromEntries(eventCounts.map((e) => [e.type, e._count._all])) as Record<string, number>,
    snapshots: snapshots.reverse(),
  };
}
