import type { LifecycleStatus, ProviderErrorReason } from "@/lib/providers/types";

const dateTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatFetchedAt(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      maximumFractionDigits: 4,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export const lifecycleLabel: Record<LifecycleStatus, string> = {
  active: "양산",
  nrnd: "신규 설계 비권장(NRND)",
  eol: "단종 예정(EOL)",
  obsolete: "단종",
  unknown: "-",
};

export const unavailableLabel: Record<ProviderErrorReason, string> = {
  rate_limited: "일시 조회 불가 (호출 한도)",
  quota_exceeded: "일시 조회 불가 (일일 한도)",
  timeout: "일시 조회 불가 (응답 지연)",
  error: "일시 조회 불가",
};
