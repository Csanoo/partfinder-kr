"use client";

import { useActionState } from "react";
import { applyFactsAction, fetchFactsAction, type FactsState } from "@/app/admin/parts/actions";

const btn = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-brand-50 disabled:opacity-50 dark:hover:bg-brand-900/30";
const btnPrimary = "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

/** 제조사 공식 페이지에서 사실 정보를 가져와 현재 값과 비교하고, 체크한 항목만 반영 */
export function ManufacturerFactsPanel({ partId, supported }: { partId: string; supported: boolean }) {
  const [fetched, fetchAction, fetching] = useActionState<FactsState>(fetchFactsAction.bind(null, partId), { status: "idle" });
  const [applied, applyAction, applying] = useActionState<FactsState, FormData>(applyFactsAction.bind(null, partId), {
    status: "idle",
  });

  if (!supported) {
    return <p className="text-sm text-muted">이 제조사는 아직 자동 가져오기를 지원하지 않습니다 (현재 TI 지원).</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <form action={fetchAction}>
        <button disabled={fetching} className={btn}>
          {fetching ? "제조사 사이트 조회 중… (요청 간격 1초)" : "제조사 공식 정보 가져오기"}
        </button>
      </form>

      {fetched.message && fetched.status !== "ok" && <p className="text-copper-700 dark:text-copper-200">{fetched.message}</p>}

      {fetched.status === "ok" && fetched.facts && fetched.proposals && applied.status !== "applied" && (
        <form action={applyAction} className="space-y-2">
          <input type="hidden" name="facts" value={JSON.stringify(fetched.facts)} />
          <p className="text-xs text-muted">
            출처:{" "}
            <a href={fetched.facts.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline dark:text-brand-300">
              {fetched.facts.sourceUrl}
            </a>{" "}
            · 사실 정보만 가져오며 설명 문장은 가져오지 않습니다.
          </p>
          {fetched.proposals.length === 0 ? (
            <p className="text-muted">반영할 새 정보가 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-8 py-1" />
                  <th className="py-1">항목</th>
                  <th className="py-1">현재</th>
                  <th className="py-1">제조사</th>
                </tr>
              </thead>
              <tbody>
                {fetched.proposals.map((p) => (
                  <tr key={p.field} className="border-t border-line align-top">
                    <td className="py-1.5">
                      <input type="checkbox" name="fields" value={p.field} defaultChecked={p.changed} aria-label={p.label} />
                    </td>
                    <td className="py-1.5 font-medium">{p.label}</td>
                    <td className="break-all py-1.5 text-muted">{p.current || "-"}</td>
                    <td className="break-all py-1.5">{p.proposed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {fetched.proposals.length > 0 && (
            <button disabled={applying} className={btnPrimary}>
              체크한 항목 반영
            </button>
          )}
        </form>
      )}

      {applied.message && (
        <p className={applied.status === "applied" ? "text-pcb-700 dark:text-pcb-100" : "text-red-600"}>{applied.message}</p>
      )}
    </div>
  );
}
