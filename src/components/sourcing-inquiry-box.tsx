import Link from "next/link";
import { inquiryHref } from "@/components/quote-inquiry-box";
import { formatFetchedAt, formatInt } from "@/lib/format";
import type { ProviderResult } from "@/lib/providers/types";
import type { SourcingReason, SourcingSignals } from "@/lib/search/sourcing";

export const SOURCING_DISCLAIMER =
  "브로커 소싱은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.";

const reasonLabel: Record<SourcingReason, string> = {
  no_results: "정식 유통사 검색 결과가 없습니다.",
  all_zero_stock: "정식 유통사 재고가 모두 0입니다.",
  qty_exceeds_stock: "입력 수량이 정식 유통사 최대 재고보다 많습니다.",
  discontinued: "단종 또는 신규 설계 비권장(NRND) 부품입니다.",
};

/**
 * C. 브로커 소싱 문의. 정식 유통사 결과(A)와 시각적으로 분리된 별도 박스.
 * 강조 조건에 해당하면 테두리·배경으로 강조하되, A를 가리거나 순서를 바꾸지 않는다.
 */
export function SourcingInquiryBox({
  mpn,
  qty,
  signals,
  brokerResults,
}: {
  mpn: string;
  qty: number | null;
  signals: SourcingSignals;
  brokerResults: ProviderResult[];
}) {
  return (
    <section
      aria-labelledby="sourcing-inquiry-heading"
      data-emphasized={signals.emphasize}
      className={
        signals.emphasize
          ? "rounded border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30"
          : "rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
      }
    >
      <h2 id="sourcing-inquiry-heading" className="mb-1 font-semibold">
        브로커 소싱 문의
      </h2>

      {signals.emphasize ? (
        <ul className="mb-2 list-disc pl-5 text-sm">
          {signals.reasons.map((r) => (
            <li key={r}>{reasonLabel[r]}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          정식 유통사에서 구하기 어려운 경우 소싱을 문의할 수 있습니다.
        </p>
      )}

      <p className="mb-3 text-xs text-zinc-700 dark:text-zinc-300">{SOURCING_DISCLAIMER}</p>

      <BrokerListings results={brokerResults} />

      <Link
        href={inquiryHref("/inquiry/sourcing", mpn, qty)}
        className="inline-block rounded border border-zinc-400 px-3 py-1.5 text-sm dark:border-zinc-600"
      >
        소싱 문의하기
      </Link>
    </section>
  );
}

/**
 * 시장 재고 참고 (broker 소스). 출처(소스명·조회 시각·링크)를 함께 표시한다.
 * 가격은 표시하지 않는다. TODO(확인필요): 브로커 소스 가격 표시 여부
 */
function BrokerListings({ results }: { results: ProviderResult[] }) {
  const offers = results.flatMap((r) => (r.status === "ok" ? r.offers : []));
  if (offers.length === 0) return null;
  return (
    <div className="mb-3" data-testid="broker-listings">
      <h3 className="mb-1 text-sm font-medium">시장 재고 참고</h3>
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
        브로커가 게시한 재고 정보로, 실제 재고·정품 여부는 확인되지 않았습니다.
      </p>
      <ul className="space-y-1 text-sm">
        {offers.map((o) => (
          <li key={`${o.providerId}:${o.productUrl}`} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{o.providerName}</span>
            <span className="font-mono">{o.mpn}</span>
            <span>{o.stock == null ? "수량 미기재" : `${formatInt(o.stock)}개 게시`}</span>
            <span className="text-xs text-zinc-500">({formatFetchedAt(o.fetchedAt)})</span>
            <a href={o.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs underline">
              출처
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
