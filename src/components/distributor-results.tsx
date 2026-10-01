import { formatFetchedAt, formatInt, formatMoney, lifecycleLabel, unavailableLabel } from "@/lib/format";
import type { Offer, ProviderResult } from "@/lib/providers/types";
import { priceAtQty, sortOffersByPrice } from "@/lib/search/pricing";

/**
 * A. 정식 유통사 결과.
 * 각 행은 하나의 유통사 데이터이며 출처(유통사명·조회 시각·상품 링크)를 함께 표시한다.
 * 정렬은 가격 순만 적용한다.
 */
export function DistributorResults({ results, qty }: { results: ProviderResult[]; qty: number | null }) {
  const offers = sortOffersByPrice(
    results.flatMap((r) => (r.status === "ok" ? r.offers : [])),
    qty,
  );
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
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                    <th className="p-2">유통사</th>
                    <th className="p-2">제조사 / 품번</th>
                    <th className="p-2">설명</th>
                    <th className="p-2 text-right">재고</th>
                    <th className="p-2">가격 구간</th>
                    <th className="p-2 text-right">MOQ</th>
                    {qty != null && <th className="p-2 text-right">{formatInt(qty)}개 기준</th>}
                    <th className="p-2">조회 시각</th>
                    <th className="p-2">링크</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <OfferRow key={`${offer.providerId}:${offer.productUrl}`} offer={offer} qty={qty} />
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

function OfferRow({ offer, qty }: { offer: Offer; qty: number | null }) {
  const breaks = [...offer.priceBreaks].sort((a, b) => a.minQty - b.minQty);
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
      <td className="p-2">{offer.description}</td>
      <td className="p-2 text-right">{offer.stock == null ? "-" : formatInt(offer.stock)}</td>
      <td className="p-2">
        {breaks.length === 0 ? (
          "-"
        ) : (
          <ul>
            {breaks.map((b) => (
              <li key={b.minQty}>
                {formatInt(b.minQty)}+ : {formatMoney(b.unitPrice, offer.currency)}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="p-2 text-right">{offer.moq == null ? "-" : formatInt(offer.moq)}</td>
      {qty != null && (
        <td className="p-2 text-right">
          <QtyPriceCell offer={offer} qty={qty} />
        </td>
      )}
      <td className="p-2 whitespace-nowrap">{formatFetchedAt(offer.fetchedAt)}</td>
      <td className="p-2">
        <a href={offer.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
          상품 페이지
        </a>
      </td>
    </tr>
  );
}

function QtyPriceCell({ offer, qty }: { offer: Offer; qty: number }) {
  const p = priceAtQty(offer, qty);
  if (p.status === "no_price") return <>-</>;
  if (p.status === "below_min") return <span className="text-xs">최소 {formatInt(p.minQty)}개</span>;
  return (
    <>
      <div>단가 {formatMoney(p.unitPrice, offer.currency)}</div>
      <div className="font-medium">합계 {formatMoney(p.total, offer.currency)}</div>
    </>
  );
}
