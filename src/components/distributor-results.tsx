import { PackageIllustration } from "@/components/package-illustration";
import { parsePackage } from "@/lib/package/parse-package";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary, type Dict } from "@/i18n";
import { formatFetchedAt, formatInt } from "@/lib/format";
import type { Offer, ProviderResult } from "@/lib/providers/types";

/**
 * A. 정식 유통사 결과.
 * 각 행은 하나의 유통사 데이터이며 출처(유통사명·조회 시각·상품 링크)를 함께 표시한다.
 * 가격은 표시하지 않는다 (결정 2026-10-01).
 *
 * 정렬: 유통사명 순. 가중치·숨김 없음.
 * TODO(확인필요): 가격 미표시 이후의 정렬 기준 (기존 명세는 가격 순)
 */
export function DistributorResults({
  results: allResults,
  locale = DEFAULT_LOCALE,
}: {
  results: ProviderResult[];
  qty?: number | null;
  locale?: Locale;
}) {
  const t = getDictionary(locale).dist;
  // broker 소스 결과는 정식 유통사 영역에 섞지 않는다.
  const results = allResults.filter((r) => r.kind === "authorized");
  const offers = sortOffersByProvider(results.flatMap((r) => (r.status === "ok" ? r.offers : [])));
  const statusRows = results.filter((r) => r.status !== "ok");

  return (
    <section aria-labelledby="distributor-results-heading" className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <h2 id="distributor-results-heading" className="font-semibold">
          {t.title}
        </h2>
        <span className="text-xs text-muted">{t.sortNote}</span>
      </div>

      {results.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.none}</p>
      ) : (
        <>
          {offers.length > 0 && (
            <ul className="divide-y divide-line md:hidden">
              {offers.map((offer) => (
                <OfferCard key={`${offer.providerId}:${offer.productUrl}`} offer={offer} t={t} locale={locale} />
              ))}
            </ul>
          )}
          {offers.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-background text-left text-xs text-muted">
                    <th className="px-5 py-2 font-medium">{t.colProvider}</th>
                    <th className="px-3 py-2 font-medium">{t.colMfrMpn}</th>
                    <th className="px-3 py-2 font-medium">{t.colDesc}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.colStock}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.colMoq}</th>
                    <th className="px-3 py-2 font-medium">{t.colFetched}</th>
                    <th className="px-5 py-2 font-medium">
                      <span className="sr-only">{t.colLink}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <OfferRow key={`${offer.providerId}:${offer.productUrl}`} offer={offer} t={t} locale={locale} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statusRows.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-t border-line px-5 py-2.5 text-xs">
              {statusRows.map((r) => (
                <li
                  key={r.providerId}
                  className={
                    r.status === "no_results"
                      ? "rounded bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : "rounded bg-copper-50 px-2 py-1 text-copper-700 dark:bg-copper-700/20 dark:text-copper-200"
                  }
                >
                  <span className="font-semibold">{r.providerName}</span> ·{" "}
                  {r.status === "no_results" ? t.noResults : t.unavailable[r.reason]}
                  <span className="ml-1 opacity-70">({formatFetchedAt(r.fetchedAt, locale)})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** 유통사명 순 (같으면 원래 순서 유지). */
export function sortOffersByProvider<T extends Pick<Offer, "providerName">>(offers: T[]): T[] {
  return offers
    .map((offer, index) => ({ offer, index }))
    .sort((a, b) => a.offer.providerName.localeCompare(b.offer.providerName, "ko") || a.index - b.index)
    .map((x) => x.offer);
}

function StockBadge({ stock, t, locale }: { stock: number | null; t: Dict["dist"]; locale: Locale }) {
  if (stock == null) return <span className="text-muted">-</span>;
  if (stock === 0) {
    return (
      <span className="whitespace-nowrap text-xs text-muted">{t.noStock}</span>
    );
  }
  return (
    <span className="mpn whitespace-nowrap font-semibold tabular-nums text-pcb-700 dark:text-pcb-100">{formatInt(stock, locale)}</span>
  );
}

function OfferRow({ offer, t, locale }: { offer: Offer; t: Dict["dist"]; locale: Locale }) {
  return (
    <tr className="border-t border-line align-middle hover:bg-background">
      <td className="whitespace-nowrap px-5 py-2.5 font-semibold">{offer.providerName}</td>
      <td className="px-3 py-2.5">
        <div className="whitespace-nowrap text-muted">{offer.manufacturer}</div>
        <div className="mpn font-medium">{offer.mpn}</div>
        {offer.lifecycle !== "active" && offer.lifecycle !== "unknown" && (
          <span className="mt-1 inline-block rounded bg-copper-100 px-1.5 py-0.5 text-[11px] font-semibold text-copper-700 dark:bg-copper-700/30 dark:text-copper-200">
            {t.lifecycle[offer.lifecycle]}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <PackageIllustration info={parsePackage(offer.description)} size={36} locale={locale} />
          <span className="text-muted">{offer.description}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <StockBadge stock={offer.stock} t={t} locale={locale} />
      </td>
      <td className="mpn px-3 py-2.5 text-right text-muted">{offer.moq == null ? "-" : formatInt(offer.moq, locale)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatFetchedAt(offer.fetchedAt, locale)}</td>
      <td className="px-5 py-2.5 text-right">
        <a
          href={offer.productUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="whitespace-nowrap text-brand-600 hover:underline dark:text-brand-300"
        >
          {t.productPage}
        </a>
      </td>
    </tr>
  );
}

/** 좁은 화면용: 표 대신 유통사별 한 덩어리 (재고가 화면 밖으로 밀리지 않게) */
function OfferCard({ offer, t, locale }: { offer: Offer; t: Dict["dist"]; locale: Locale }) {
  return (
    <li className="space-y-1 px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{offer.providerName}</span>
        <StockBadge stock={offer.stock} t={t} locale={locale} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="mpn font-medium">{offer.mpn}</span>
        <span className="text-muted">{offer.manufacturer}</span>
        {offer.lifecycle !== "active" && offer.lifecycle !== "unknown" && (
          <span className="rounded bg-copper-100 px-1.5 py-0.5 text-[11px] font-semibold text-copper-700 dark:bg-copper-700/30 dark:text-copper-200">
            {t.lifecycle[offer.lifecycle]}
          </span>
        )}
      </div>
      <p className="text-muted">{offer.description}</p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
        <span>
          MOQ {offer.moq == null ? "-" : formatInt(offer.moq, locale)} · {formatFetchedAt(offer.fetchedAt, locale)}
        </span>
        <a href={offer.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-brand-600 hover:underline dark:text-brand-300">
          {t.productPage}
        </a>
      </div>
    </li>
  );
}
