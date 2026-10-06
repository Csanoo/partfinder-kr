import Link from "next/link";
import { pagePath, type HubModel } from "@/lib/parts/hubs";
import { LIFECYCLE_TEXT, ymd } from "@/lib/parts/page-model";

const tone: Record<string, string> = {
  active: "bg-pcb-50 text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100",
  nrnd: "bg-copper-100 text-copper-700 dark:bg-copper-700/25 dark:text-copper-200",
  ltb: "bg-copper-100 text-copper-700 dark:bg-copper-700/25 dark:text-copper-200",
  eol: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  unknown: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

/** 제조사·카테고리·단종 목록 공통 화면 (서버 렌더링, 핵심 목록은 HTML에 포함) */
export function HubView({ hub, breadcrumbName }: { hub: HubModel; breadcrumbName: string }) {
  return (
    <div className="space-y-6">
      <nav aria-label="경로" className="text-sm text-muted">
        <Link href="/" className="hover:underline">
          홈
        </Link>{" "}
        / <span aria-current="page">{breadcrumbName}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{hub.title}</h1>
        <p className="max-w-3xl leading-relaxed text-muted">{hub.intro}</p>
      </header>

      {hub.facets.length > 0 && (
        <nav aria-label={hub.kind === "manufacturer" ? "카테고리별" : "제조사별"} className="flex flex-wrap gap-2">
          {hub.facets.map((f) => (
            <Link key={f.path} href={f.path} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand-400">
              {f.label} <span className="text-muted">{f.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {hub.items.length === 0 ? (
        <p className="rounded-md border border-line bg-surface p-6 text-muted">아직 등록된 부품이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">품번</th>
                <th className="px-4 py-2 font-medium">{hub.kind === "manufacturer" ? "카테고리" : "제조사"}</th>
                <th className="px-4 py-2 font-medium">수명주기</th>
                {hub.kind === "eol" && <th className="px-4 py-2 font-medium">단종 시점</th>}
              </tr>
            </thead>
            <tbody>
              {hub.items.map((it) => (
                <tr key={it.path} className="border-t border-line hover:bg-brand-50/50 dark:hover:bg-brand-900/20">
                  <td className="px-4 py-2.5">
                    <Link href={it.path} className="mpn font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {it.mpn}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{hub.kind === "manufacturer" ? (it.categoryName ?? "-") : it.manufacturerName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone[it.lifecycle]}`}>
                      {LIFECYCLE_TEXT[it.lifecycle]}
                    </span>
                  </td>
                  {hub.kind === "eol" && <td className="px-4 py-2.5 text-muted">{it.eolDate ? ymd(it.eolDate) : "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hub.pageCount > 1 && (
        <nav aria-label="페이지" className="flex flex-wrap gap-1 text-sm">
          {Array.from({ length: hub.pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={pagePath(hub.path, n)}
              aria-current={n === hub.page ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${n === hub.page ? "bg-brand-600 text-white" : "border border-line bg-surface hover:border-brand-400"}`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}

    </div>
  );
}
