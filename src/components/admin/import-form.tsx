"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importAction, type ImportState } from "@/app/admin/parts/actions";

const btnPrimary = "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
const btnSecondary = "rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-brand-50 disabled:opacity-50 dark:hover:bg-brand-900/30";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, { stage: "idle" });

  if (state.stage === "done" && state.result) {
    return (
      <div className="space-y-3 rounded-md border border-pcb-500/40 bg-pcb-50 p-4 text-sm dark:bg-pcb-700/20">
        <p className="font-semibold">{state.result.created}건을 초안으로 만들었습니다.</p>
        {state.result.failed.length > 0 && (
          <ul className="list-disc pl-5 text-red-700">
            {state.result.failed.map((f) => (
              <li key={f.line}>
                {f.line}행: {f.message}
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/parts?status=draft" className="text-brand-600 underline">
          초안 목록 보기
        </Link>
      </div>
    );
  }

  const plan = state.plan;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3 rounded-md border border-line bg-surface p-4">
        <input type="hidden" name="mode" value="preview" />
        <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
        <p className="text-xs text-muted">또는 아래에 CSV 내용을 붙여 넣으세요.</p>
        <textarea
          name="csv"
          rows={6}
          defaultValue={state.csv ?? ""}
          className="mpn w-full rounded-md border border-line bg-surface p-2 text-xs"
          placeholder="mpn,manufacturer,category,..."
        />
        <button disabled={pending} className={btnSecondary}>
          {pending ? "검증 중…" : "검증하기"}
        </button>
      </form>

      {plan && (
        <div className="space-y-3 rounded-md border border-line bg-surface p-4 text-sm">
          <p>
            생성 <b>{plan.create.length}</b> · 건너뜀 <b>{plan.skipped.length}</b> · 오류{" "}
            <b className={plan.errors.length ? "text-red-600" : ""}>{plan.errors.length}</b>
          </p>

          {plan.newManufacturers.length > 0 && (
            <p className="rounded bg-copper-50 p-2 text-copper-700 dark:bg-copper-700/20 dark:text-copper-200">
              새로 만들 제조사: {plan.newManufacturers.map(([slug, name]) => `${name} (${slug})`).join(", ")} — 이미 다른 이름으로
              등록된 제조사가 아닌지 확인하세요.
            </p>
          )}

          {plan.errors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-red-700 dark:text-red-300">
              {plan.errors.map((e, i) => (
                <li key={i}>
                  {e.line > 0 ? `${e.line}행: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          )}

          {plan.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-muted">건너뛴 행 {plan.skipped.length}건</summary>
              <ul className="mpn mt-1 list-disc pl-5 text-xs text-muted">
                {plan.skipped.map((s) => (
                  <li key={s.line}>
                    {s.line}행 {s.mpn}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {plan.create.length > 0 && (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1">행</th>
                    <th>품번</th>
                    <th>제조사</th>
                    <th>카테고리</th>
                    <th>수명주기</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.create.map((r) => (
                    <tr key={r.line} className="border-t border-line">
                      <td className="py-1">{r.line}</td>
                      <td className="mpn">{r.mpn}</td>
                      <td>{r.manufacturerSlug}</td>
                      <td>{r.categorySlug ?? "-"}</td>
                      <td>{r.lifecycleStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form action={action}>
            <input type="hidden" name="mode" value="execute" />
            <input type="hidden" name="csv" value={state.csv ?? ""} />
            <button disabled={pending || plan.errors.length > 0 || plan.create.length === 0} className={btnPrimary}>
              {plan.errors.length > 0 ? "오류를 고친 뒤 다시 검증하세요" : `${plan.create.length}건 가져오기`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
