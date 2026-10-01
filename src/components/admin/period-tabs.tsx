import Link from "next/link";
import { PERIODS } from "@/lib/metrics";

export function PeriodTabs({ base, days }: { base: string; days: number }) {
  return (
    <nav aria-label="기간" className="flex gap-1 text-sm">
      {PERIODS.map((d) => (
        <Link
          key={d}
          href={`${base}?days=${d}`}
          aria-current={d === days ? "page" : undefined}
          className={`rounded-full px-3 py-1 ${d === days ? "bg-brand-600 text-white" : "border border-line bg-surface hover:border-brand-400"}`}
        >
          최근 {d}일
        </Link>
      ))}
    </nav>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border bg-surface p-4 ${tone === "warn" ? "border-copper-400" : "border-line"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
