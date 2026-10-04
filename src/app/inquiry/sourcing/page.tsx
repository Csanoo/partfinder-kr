import type { Metadata } from "next";
import { submitSourcingInquiry } from "@/app/inquiry/actions";
import { InquiryForm } from "@/components/inquiry-form";
import { TrackOnMount } from "@/components/track-view";
import { SOURCING_DISCLAIMER } from "@/components/sourcing-inquiry-box";
import { consentTexts } from "@/lib/inquiry/consent";
import { parseQty } from "@/lib/search/normalize";

export const metadata: Metadata = { title: "소싱 문의", robots: { index: false, follow: false } };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SourcingInquiryPage(props: PageProps<"/inquiry/sourcing">) {
  const sp = await props.searchParams;
  const qty = parseQty(first(sp.qty));
  const consent = consentTexts();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <TrackOnMount type="sourcing_form_open" />
      <h1 className="text-2xl font-bold">소싱 문의</h1>
      <p className="rounded-lg border border-copper-300 bg-copper-50 p-3 text-sm text-copper-700 dark:border-copper-600 dark:bg-copper-700/15 dark:text-copper-200">
        {SOURCING_DISCLAIMER}
      </p>
      <InquiryForm
        type="sourcing"
        action={submitSourcingInquiry}
        defaults={{ mpn: first(sp.mpn).slice(0, 64), qty: qty == null ? "" : String(qty), searchLogId: first(sp.sl) }}
        consent={consent}
      />
    </div>
  );
}
