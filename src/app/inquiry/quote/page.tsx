import type { Metadata } from "next";
import { submitQuoteInquiry } from "@/app/inquiry/actions";
import { InquiryForm } from "@/components/inquiry-form";
import { consentTexts } from "@/lib/inquiry/consent";
import { parseQty } from "@/lib/search/normalize";

export const metadata: Metadata = { title: "견적 문의", robots: { index: false, follow: false } };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function QuoteInquiryPage(props: PageProps<"/inquiry/quote">) {
  const sp = await props.searchParams;
  const qty = parseQty(first(sp.qty));
  const consent = consentTexts();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">견적 문의</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        품번과 수량을 남기시면 담당자가 확인 후 연락드립니다. 연락처는 회신 용도로만 사용합니다.
      </p>
      <InquiryForm
        type="quote"
        action={submitQuoteInquiry}
        defaults={{ mpn: first(sp.mpn).slice(0, 64), qty: qty == null ? "" : String(qty), searchLogId: first(sp.sl) }}
        consent={consent}
      />
    </div>
  );
}
