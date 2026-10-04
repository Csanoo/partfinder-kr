import { DistributorResults } from "@/components/distributor-results";
import { QuoteInquiryBox } from "@/components/quote-inquiry-box";
import { SourcingInquiryBox } from "@/components/sourcing-inquiry-box";
import type { ProviderResult } from "@/lib/providers/types";
import { evaluateSourcingSignals } from "@/lib/search/sourcing";

/**
 * 결과 화면 영역 배치. A(정식 유통사) → B(견적 문의) → C(소싱) 순서 고정.
 * 문의 영역은 항상 A 아래에 두어 정식 유통사 결과를 가리거나 순서를 바꾸지 않는다.
 */
export function SearchResultSections({
  results,
  mpn,
  qty,
  searchLogId = null,
}: {
  results: ProviderResult[];
  mpn: string;
  qty: number | null;
  searchLogId?: string | null;
}) {
  const signals = evaluateSourcingSignals(results, qty);
  return (
    <>
      <DistributorResults results={results} qty={qty} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <QuoteInquiryBox mpn={mpn} qty={qty} searchLogId={searchLogId} />
        <SourcingInquiryBox
          mpn={mpn}
          qty={qty}
          signals={signals}
          brokerResults={results.filter((r) => r.kind === "broker")}
          searchLogId={searchLogId}
        />
      </div>
    </>
  );
}
