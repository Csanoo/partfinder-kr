import type { Metadata } from "next";
import { submitPartRequest } from "@/app/inquiry/actions";
import { RequestForm } from "@/components/request-form";
import { RequestSteps } from "@/components/request-steps";
import { TrackOnMount } from "@/components/track-view";
import { consentTexts } from "@/lib/inquiry/consent";
import { parseQty } from "@/lib/search/normalize";

export const metadata: Metadata = {
  title: "부품 요청",
  description: "필요한 전자부품의 품번과 수량을 알려주시면 정식 유통 재고부터 단종·품귀 부품까지 찾아서 회신드립니다.",
  alternates: { canonical: "/request" },
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function RequestPage(props: PageProps<"/request">) {
  const sp = await props.searchParams;
  const qty = parseQty(first(sp.qty));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <TrackOnMount type="sourcing_form_open" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">부품 요청</h1>
          <p className="mt-1 text-sm text-muted">필요한 부품의 품번과 수량을 알려주세요. 정식 유통 재고부터 단종·품귀 부품까지 찾아서 회신드립니다.</p>
        </div>
        <RequestForm
          action={submitPartRequest}
          defaults={{ mpn: first(sp.mpn).slice(0, 64), qty: qty == null ? "" : String(qty), searchLogId: first(sp.sl) }}
          consent={consentTexts()}
        />
      </div>
      <RequestSteps />
    </div>
  );
}
