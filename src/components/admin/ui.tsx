import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200 dark:focus-visible:ring-brand-800";
export const btnPrimary =
  "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
export const btnSecondary =
  "rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/30";
export const btnDanger = "rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  review: "bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200",
  published: "bg-pcb-50 text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100",
  unpublished: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
export const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  review: "검토 중",
  published: "게시",
  unpublished: "비게시",
};
export const LIFECYCLE_LABEL: Record<string, string> = {
  active: "양산(Active)",
  nrnd: "NRND",
  ltb: "LTB",
  eol: "단종(EOL)",
  unknown: "미확인",
};
export const RELATION_LABEL: Record<string, string> = { drop_in: "핀 호환", similar: "유사", upgrade: "상위 호환" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function IndexableBadge({ indexable }: { indexable: boolean }) {
  return indexable ? (
    <span className="whitespace-nowrap rounded-full bg-pcb-50 px-2 py-0.5 text-xs font-semibold text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100">
      색인
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      noindex
    </span>
  );
}

export function Notice({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={
        error
          ? "rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-md border border-pcb-500/40 bg-pcb-50 p-3 text-sm text-pcb-700 dark:bg-pcb-700/20 dark:text-pcb-100"
      }
    >
      {error || message}
    </p>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function daysSince(d: Date | null, now = new Date()): number | null {
  return d == null ? null : Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

export function ymd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
