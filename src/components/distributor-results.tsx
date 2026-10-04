import { PackageIllustration } from "@/components/package-illustration";
import { parsePackage } from "@/lib/package/parse-package";
import { formatFetchedAt, formatInt, lifecycleLabel, unavailableLabel } from "@/lib/format";
import type { Offer, ProviderResult } from "@/lib/providers/types";

/**
 * A. 정식 유통사 결과.
 * 각 행은 하나의 유통사 데이터이며 출처(유통사명·조회 시각·상품 링크)를 함께 표시한다.
 * 가격은 표시하지 않는다 (결정 2026-10-01).
 *
 * 정렬: 유통사명 순. 가중치·숨김 없음.
 * TODO(확인필요): 가격 미표시 이후의 정렬 기준 (기존 명세는 가격 순)
 */
export function DistributorResults({ results: allResults }: { results: ProviderResult[]; qty?: number | null }) {
  // broker 소스 결과는 정식 유통사 영역에 섞지 않는다.
  const results = allResults.filter((r) => r.kind === "authorized");
  const offers = sortOffersByProvider(results.flatMap((r) => (r.status === "ok" ? r.offers : [])));
  const statusRows = results.filter((r) => r.status !== "ok");

  return (
    <section aria-labelledby="distributor-results-heading" className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="distributor-results-heading" className="font-semibold">
          정식 유통사 결과
        </h2>
        <span className="text-xs text-muted">유통사명 순 · 가격은 견적 문의로 안내</span>
      </div>

      {results.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">현재 조회 가능한 유통사가 없습니다.</p>
      ) : (
        <>
          {offers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-2 font-medium">유통사</th>
                    <th className="px-3 py-2 font-medium">제조사 / 품번</th>
                    <th className="px-3 py-2 font-medium">설명</th>
                    <th className="px-3 py-2 text-right font-medium">재고</th>
                    <th className="px-3 py-2 text-right font-medium">MOQ</th>
                    <th className="px-3 py-2 font-medium">조회 시각</th>
                    <th className="px-5 py-2 font-medium">
                      <span className="sr-only">링크</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <OfferRow key={`${offer.providerId}:${offer.productUrl}`} offer={offer} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statusRows.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-t border-line px-5 py-3 text-xs">
              {statusRows.map((r) => (
                <li
                  key={r.providerId}
                  className={
                    r.status === "no_results"
                      ? "rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : "rounded-full bg-copper-50 px-3 py-1 text-copper-700 dark:bg-copper-700/20 dark:text-copper-200"
                  }
                >
                  <span className="font-semibold">{r.providerName}</span> ·{" "}
                  {r.status === "no_results" ? "검색 결과 없음" : unavailableLabel[r.reason]}
                  <span className="ml-1 opacity-70">({formatFetchedAt(r.fetchedAt)})</span>
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

function StockBadge({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="text-muted">-</span>;
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        <span className="size-1.5 rounded-full bg-zinc-400" />
        재고 없음
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-pcb-50 px-2 py-0.5 text-xs font-semibold text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100">
      <span className="size-1.5 rounded-full bg-pcb-500" />
      {formatInt(stock)}
    </span>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <tr className="border-t border-line align-middle hover:bg-brand-50/50 dark:hover:bg-brand-900/20">
      <td className="whitespace-nowrap px-5 py-3 font-semibold">{offer.providerName}</td>
      <td className="px-3 py-3">
        <div className="whitespace-nowrap text-muted">{offer.manufacturer}</div>
        <div className="mpn font-medium">{offer.mpn}</div>
        {offer.lifecycle !== "active" && offer.lifecycle !== "unknown" && (
          <span className="mt-1 inline-block rounded bg-copper-100 px-1.5 py-0.5 text-[11px] font-semibold text-copper-700 dark:bg-copper-700/30 dark:text-copper-200">
            {lifecycleLabel[offer.lifecycle]}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <PackageIllustration info={parsePackage(offer.description)} size={36} />
          <span className="text-muted">{offer.description}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <StockBadge stock={offer.stock} />
      </td>
      <td className="mpn px-3 py-3 text-right text-muted">{offer.moq == null ? "-" : formatInt(offer.moq)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{formatFetchedAt(offer.fetchedAt)}</td>
      <td className="px-5 py-3 text-right">
        <a
          href={offer.productUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="whitespace-nowrap text-brand-600 hover:underline dark:text-brand-300"
        >
          상품 페이지 ↗
        </a>
      </td>
    </tr>
  );
}
