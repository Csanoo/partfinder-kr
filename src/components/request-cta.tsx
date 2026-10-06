import Link from "next/link";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { formatFetchedAt, formatInt } from "@/lib/format";
import type { ProviderResult } from "@/lib/providers/types";
import type { SourcingReason, SourcingSignals } from "@/lib/search/sourcing";

/** 한국어 고지 문구 (다른 언어는 사전의 common.sourcingDisclaimer) */
export const SOURCING_DISCLAIMER = getDictionary("ko").common.sourcingDisclaimer;

export function requestHref(mpn: string, qty: number | null, searchLogId: string | null = null, locale: Locale = DEFAULT_LOCALE): string {
  const params = new URLSearchParams({ mpn });
  if (qty != null) params.set("qty", String(qty));
  if (searchLogId) params.set("sl", searchLogId);
  return `${localePath(locale, "/request")}?${params.toString()}`;
}

/**
 * 검색 결과 맨 위: 이 부품 요청하기. 정식 유통 재고가 부족하면(강조 조건) 이유를 함께 보여준다.
 * 강조 여부는 문구에만 영향을 주고, 아래 참고용 재고 표의 순서·내용은 바꾸지 않는다.
 */
export function RequestCta({
  mpn,
  qty,
  signals,
  searchLogId = null,
  locale = DEFAULT_LOCALE,
}: {
  mpn: string;
  qty: number | null;
  signals: SourcingSignals;
  searchLogId?: string | null;
  locale?: Locale;
}) {
  const d = getDictionary(locale);
  const t = d.cta;
  return (
    <section
      aria-labelledby="request-cta-heading"
      data-emphasized={signals.emphasize}
      className="flex flex-col gap-4 rounded-md border border-brand-600 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-400"
    >
      <div className="space-y-1">
        <h2 id="request-cta-heading" className="text-lg font-bold">
          {signals.emphasize ? t.titleEmphasized : t.titleNormal}
        </h2>
        {signals.emphasize ? (
          <ul className="list-disc pl-5 text-sm text-copper-700 dark:text-copper-200">
            {signals.reasons.map((r) => (
              <li key={r}>{t.reasons[r as SourcingReason]}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t.leadNormal}</p>
        )}
        <p className="text-xs text-muted">
          {t.note} {d.common.sourcingDisclaimer}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
        <Link
          href={requestHref(mpn, qty, searchLogId, locale)}
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t.button}
        </Link>
        <Link href={localePath(locale, "/request")} className="text-xs text-brand-600 hover:underline dark:text-brand-300">
          {t.bom}
        </Link>
      </div>
    </section>
  );
}

/**
 * 시장 재고 참고 (broker 소스). 출처(소스명·조회 시각·링크)를 함께 표시한다.
 * 가격은 표시하지 않는다. TODO(확인필요): 소싱 소스 가격 표시 여부
 */
export function BrokerListings({ results, locale = DEFAULT_LOCALE }: { results: ProviderResult[]; locale?: Locale }) {
  const t = getDictionary(locale).broker;
  const offers = results.flatMap((r) => (r.status === "ok" ? r.offers : []));
  if (offers.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface p-4" data-testid="broker-listings">
      <h3 id="broker-listings-heading" className="mb-1 text-sm font-semibold">
        {t.title}
      </h3>
      <p className="mb-2 text-xs text-muted">{t.note}</p>
      <ul className="space-y-1 text-sm">
        {offers.map((o) => (
          <li key={`${o.providerId}:${o.productUrl}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{o.providerName}</span>
            <span className="mpn text-xs">{o.mpn}</span>
            <span>{o.stock == null ? t.qtyUnknown : fmt(t.posted, { n: formatInt(o.stock, locale) })}</span>
            <span className="text-xs text-muted">({formatFetchedAt(o.fetchedAt, locale)})</span>
            <a href={o.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-brand-600 hover:underline dark:text-brand-300">
              {t.source}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
