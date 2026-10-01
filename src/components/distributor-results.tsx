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
    <section aria-labelledby="distributor-results-heading">
      <h2 id="distributor-results-heading" className="mb-3 text-lg font-semibold">
        정식 유통사 결과
      </h2>

      {results.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">현재 조회 가능한 유통사가 없습니다.</p>
      ) : (
        <>
          {offers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                    <th className="p-2">유통사</th>
                    <th className="p-2">제조사 / 품번</th>
                    <th className="p-2">설명</th>
                    <th className="p-2 text-right">재고</th>
                    <th className="p-2 text-right">MOQ</th>
                    <th className="p-2">조회 시각</th>
                    <th className="p-2">링크</th>
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
            <ul className="mt-3 space-y-1 text-sm">
              {statusRows.map((r) => (
                <li key={r.providerId} className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.providerName}</span>:{" "}
                  {r.status === "no_results" ? "검색 결과 없음" : unavailableLabel[r.reason]}{" "}
                  <span className="text-xs">({formatFetchedAt(r.fetchedAt)})</span>
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

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <tr className="border-b border-zinc-200 align-top dark:border-zinc-800">
      <td className="p-2 font-medium">{offer.providerName}</td>
      <td className="p-2">
        <div>{offer.manufacturer}</div>
        <div className="font-mono">{offer.mpn}</div>
        {offer.lifecycle !== "active" && offer.lifecycle !== "unknown" && (
          <div className="text-xs text-amber-700 dark:text-amber-400">{lifecycleLabel[offer.lifecycle]}</div>
        )}
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <PackageIllustration info={parsePackage(offer.description)} size={36} />
          <span>{offer.description}</span>
        </div>
      </td>
      <td className="p-2 text-right">{offer.stock == null ? "-" : formatInt(offer.stock)}</td>
      <td className="p-2 text-right">{offer.moq == null ? "-" : formatInt(offer.moq)}</td>
      <td className="p-2 whitespace-nowrap">{formatFetchedAt(offer.fetchedAt)}</td>
      <td className="p-2">
        <a href={offer.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
          상품 페이지
        </a>
      </td>
    </tr>
  );
}
