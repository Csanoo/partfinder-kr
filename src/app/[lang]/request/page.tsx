import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestForm } from "@/components/request-form";
import { RequestSteps } from "@/components/request-steps";
import { TrackOnMount } from "@/components/track-view";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { alternatesFor } from "@/i18n/seo";
import { submitPartRequest } from "@/lib/inquiry/actions";
import { consentFor } from "@/lib/inquiry/consent";
import { parseQty } from "@/lib/search/normalize";

export async function generateMetadata(props: PageProps<"/[lang]/request">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).request;
  return { title: t.title, description: t.description, alternates: alternatesFor(lang, "/request") };
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function RequestPage(props: PageProps<"/[lang]/request">) {
  const { lang } = await props.params;
  if (!hasLocale(lang)) notFound();
  const d = getDictionary(lang);
  const sp = await props.searchParams;
  const qty = parseQty(first(sp.qty));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <TrackOnMount type="sourcing_form_open" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{d.request.title}</h1>
          <p className="mt-1 text-sm text-muted">{d.request.lead}</p>
        </div>
        <RequestForm
          action={submitPartRequest}
          defaults={{ mpn: first(sp.mpn).slice(0, 64), qty: qty == null ? "" : String(qty), searchLogId: first(sp.sl) }}
          consent={consentFor(lang)}
          t={d.form}
          locale={lang}
        />
      </div>
      <RequestSteps locale={lang} />
    </div>
  );
}
