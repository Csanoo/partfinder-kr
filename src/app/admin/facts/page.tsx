import Link from "next/link";
import { applySelectedAction, dismissSelectedAction, runBatchAction } from "@/app/admin/facts/actions";
import { btnPrimary, btnSecondary, first, Notice } from "@/components/admin/ui";
import type { FactStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ADMIN_BATCH_SIZE, pickTargets } from "@/lib/manufacturer/batch";
import { buildProposals } from "@/lib/manufacturer/proposals";
import type { ManufacturerFacts } from "@/lib/manufacturer/types";

const STATUS_LABEL: Record<FactStatus, string> = {
  pending: "검토 대기",
  applied: "반영됨",
  dismissed: "무시함",
  not_found: "못 찾음",
  failed: "실패",
};

export default async function FactsPage(props: PageProps<"/admin/facts">) {
  const sp = await props.searchParams;
  const status = (first(sp.status) || "pending") as FactStatus;

  const [rows, counts, waiting] = await Promise.all([
    db().manufacturerFact.findMany({
      where: { status },
      orderBy: { fetchedAt: "desc" },
      take: 200,
      include: {
        part: {
          select: {
            id: true,
            mpnDisplay: true,
            pageStatus: true,
            lifecycleStatus: true,
            lifecycleCheckedAt: true,
            package: true,
            datasheetUrl: true,
            keySpecs: true,
            manufacturer: { select: { nameEn: true } },
          },
        },
      },
    }),
    db().manufacturerFact.groupBy({ by: ["status"], _count: { _all: true } }),
    pickTargets(1000, ["draft", "review"], 30).then((t) => t.length),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">제조사 공식 정보 검토</h1>
          <p className="text-sm text-muted">
            조회 대기 부품 {waiting}개 (초안·검토 중, 지원 제조사: TI). 조회 결과는 반영 전까지 부품에 적용되지 않습니다.
          </p>
        </div>
        <form action={runBatchAction}>
          <button className={btnPrimary} disabled={waiting === 0}>
            다음 {ADMIN_BATCH_SIZE}개 조회 (약 {ADMIN_BATCH_SIZE * 4}초)
          </button>
        </form>
      </div>
      <p className="text-xs text-muted">
        많은 양은 터미널에서 <code className="mpn">npm run mfr:fetch -- --limit=200</code> 으로 실행하세요. 요청 간격 1초를 지키며, 차단되면
        자동으로 멈춥니다.
      </p>

      <Notice error={first(sp.error)} message={first(sp.message)} />

      <nav className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(STATUS_LABEL) as FactStatus[]).map((s) => (
          <Link
            key={s}
            href={`/admin/facts?status=${s}`}
            className={`rounded-full px-3 py-1 ${s === status ? "bg-brand-600 text-white" : "border border-line bg-surface"}`}
          >
            {STATUS_LABEL[s]} {countOf(s)}
          </Link>
        ))}
      </nav>

      <form className="space-y-2">
        {status === "pending" && rows.length > 0 && (
          <div className="flex gap-2">
            <button formAction={applySelectedAction} className={btnPrimary}>
              선택 항목의 바뀐 값 반영
            </button>
            <button formAction={dismissSelectedAction} className={btnSecondary}>
              선택 무시
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">품번</th>
                <th className="px-3 py-2 font-medium">바뀌는 값 (현재 → 제조사)</th>
                <th className="px-3 py-2 font-medium">출처</th>
                <th className="px-3 py-2 font-medium">조회</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted">
                    해당 상태의 결과가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const facts = r.facts as unknown as ManufacturerFacts | null;
                const keySpecs = Array.isArray(r.part.keySpecs) ? (r.part.keySpecs as { label: string; value: string }[]) : [];
                const changes = facts ? buildProposals({ ...r.part, keySpecs }, facts).filter((p) => p.changed) : [];
                return (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="px-3 py-2">
                      {r.status === "pending" && <input type="checkbox" name="ids" value={r.id} defaultChecked aria-label={`${r.part.mpnDisplay} 선택`} />}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/parts/${r.part.id}`} className="mpn font-medium text-brand-700 hover:underline dark:text-brand-300">
                        {r.part.mpnDisplay}
                      </Link>
                      <span className="block text-xs text-muted">{r.part.manufacturer.nameEn}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {facts ? (
                        <ul className="space-y-0.5">
                          {changes.map((c) => (
                            <li key={c.field}>
                              <span className="font-medium">{c.label}</span>: <span className="text-muted">{c.current || "-"}</span> →{" "}
                              <span className="break-all">{c.proposed}</span>
                            </li>
                          ))}
                          {changes.length === 0 && <li className="text-muted">바뀌는 값 없음</li>}
                        </ul>
                      ) : (
                        <span className="text-muted">{r.message}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {facts && (
                        <a href={facts.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-300">
                          제조사 페이지 ↗
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.fetchedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
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
