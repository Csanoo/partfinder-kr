import Link from "next/link";
import { bulkPublishAction } from "@/app/admin/parts/actions";
import {
  btnPrimary,
  btnSecondary,
  daysSince,
  first,
  IndexableBadge,
  inputCls,
  LIFECYCLE_LABEL,
  Notice,
  STATUS_LABEL,
  StatusBadge,
} from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import type { PageStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { BULK_PUBLISH_LIMIT } from "@/lib/parts/admin";
import { monthsAgo, qualityConfig } from "@/lib/parts/quality";

const LIST_LIMIT = 500; // TODO: 부품이 늘면 페이지 나누기

export default async function AdminPartsPage(props: PageProps<"/admin/parts">) {
  const sp = await props.searchParams;
  const status = first(sp.status);
  const idx = first(sp.idx);
  const stale = first(sp.stale) === "1";
  const q = first(sp.q).trim();

  const now = new Date();
  const staleBefore = monthsAgo(now, qualityConfig().lifecycleMaxAgeMonths);

  const where: Prisma.PartWhereInput = {
    ...(STATUS_LABEL[status] ? { pageStatus: status as PageStatus } : {}),
    ...(idx === "yes" ? { indexable: true } : idx === "no" ? { indexable: false } : {}),
    ...(stale ? { OR: [{ lifecycleCheckedAt: null }, { lifecycleCheckedAt: { lt: staleBefore } }] } : {}),
    ...(q ? { mpnKey: { contains: q.replace(/[\s-]+/g, "").toUpperCase() } } : {}),
  };

  const [rows, counts] = await Promise.all([
    db().part.findMany({
      where,
      take: LIST_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        mpnDisplay: true,
        pageStatus: true,
        indexable: true,
        lifecycleStatus: true,
        lifecycleCheckedAt: true,
        updatedAt: true,
        manufacturer: { select: { nameEn: true } },
        category: { select: { nameKo: true } },
      },
    }),
    db().part.groupBy({ by: ["pageStatus"], _count: { _all: true } }),
  ]);

  // 확인일 12개월 경과 부품을 목록 상단에 (SEO_SPEC 7장)
  const isStale = (d: Date | null) => d != null && d < staleBefore;
  const parts = [...rows].sort((a, b) => Number(isStale(b.lifecycleCheckedAt)) - Number(isStale(a.lifecycleCheckedAt)));
  const countOf = (s: string) => counts.find((c) => c.pageStatus === s)?._count._all ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">부품 페이지</h1>
          <p className="text-sm text-muted">
            {Object.entries(STATUS_LABEL)
              .map(([k, label]) => `${label} ${countOf(k)}`)
              .join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/parts/import" className={btnSecondary}>
            CSV 가져오기
          </Link>
          <Link href="/admin/parts/new" className={btnPrimary}>
            부품 등록
          </Link>
        </div>
      </div>

      <Notice error={first(sp.error)} message={first(sp.message)} />

      <form className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3 text-sm">
        <input name="q" defaultValue={q} placeholder="품번 검색" className={`${inputCls} w-48`} />
        <select name="status" defaultValue={status} className={`${inputCls} w-32`}>
          <option value="">상태 전체</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select name="idx" defaultValue={idx} className={`${inputCls} w-32`}>
          <option value="">색인 전체</option>
          <option value="yes">색인 가능</option>
          <option value="no">noindex</option>
        </select>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" name="stale" value="1" defaultChecked={stale} /> 재확인 필요만
        </label>
        <button className={btnSecondary}>필터</button>
      </form>

      <form action={bulkPublishAction} className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {parts.length}건{rows.length === LIST_LIMIT && ` (최대 ${LIST_LIMIT}건 표시)`}
          </span>
          <button className={btnPrimary}>선택 항목 게시 (최대 {BULK_PUBLISH_LIMIT}건)</button>
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">품번</th>
                <th className="px-3 py-2 font-medium">제조사</th>
                <th className="px-3 py-2 font-medium">카테고리</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">색인</th>
                <th className="px-3 py-2 font-medium">수명주기</th>
                <th className="px-3 py-2 font-medium">확인일 경과</th>
              </tr>
            </thead>
            <tbody>
              {parts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted">
                    부품이 없습니다.
                  </td>
                </tr>
              )}
              {parts.map((p) => {
                const days = daysSince(p.lifecycleCheckedAt, now);
                const staleRow = isStale(p.lifecycleCheckedAt);
                return (
                  <tr key={p.id} className={`border-t border-line ${staleRow ? "bg-copper-50/60 dark:bg-copper-700/10" : ""}`}>
                    <td className="px-3 py-2">
                      {p.pageStatus !== "published" && <input type="checkbox" name="ids" value={p.id} aria-label={`${p.mpnDisplay} 선택`} />}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/parts/${p.id}`} className="mpn font-medium text-brand-700 hover:underline dark:text-brand-300">
                        {p.mpnDisplay}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{p.manufacturer.nameEn}</td>
                    <td className="px-3 py-2 text-muted">{p.category?.nameKo ?? "-"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.pageStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <IndexableBadge indexable={p.indexable} />
                    </td>
                    <td className="px-3 py-2">{LIFECYCLE_LABEL[p.lifecycleStatus]}</td>
                    <td className="px-3 py-2">
                      {days == null ? (
                        <span className="text-muted">확인일 없음</span>
                      ) : staleRow ? (
                        <span className="rounded bg-copper-500 px-1.5 py-0.5 text-xs font-bold text-white">재확인 필요 · {days}일</span>
                      ) : (
                        `${days}일`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
