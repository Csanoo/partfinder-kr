import { LOCALE_TAG, type Locale } from "@/i18n/config";

/** 조회 시각은 언어와 관계없이 한국 시간 기준 (서비스 운영 기준) */
export function formatFetchedAt(iso: string, locale: Locale = "ko"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatInt(n: number, locale: Locale = "ko"): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(n);
}
