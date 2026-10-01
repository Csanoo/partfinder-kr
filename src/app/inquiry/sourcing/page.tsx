import type { Metadata } from "next";
import { submitSourcingInquiry } from "@/app/inquiry/actions";
import { InquiryForm } from "@/components/inquiry-form";
import { SOURCING_DISCLAIMER } from "@/components/sourcing-inquiry-box";
import { consentTexts } from "@/lib/inquiry/consent";
import { parseQty } from "@/lib/search/normalize";

export const metadata: Metadata = { title: "브로커 소싱 문의", robots: { index: false, follow: false } };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SourcingInquiryPage(props: PageProps<"/inquiry/sourcing">) {
  const sp = await props.searchParams;
  const qty = parseQty(first(sp.qty));
  const consent = consentTexts();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">브로커 소싱 문의</h1>
      <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">{SOURCING_DISCLAIMER}</p>
      <InquiryForm
        type="sourcing"
        action={submitSourcingInquiry}
        defaults={{ mpn: first(sp.mpn).slice(0, 64), qty: qty == null ? "" : String(qty), searchLogId: first(sp.sl) }}
        consent={consent}
      />
    </div>
  );
}
