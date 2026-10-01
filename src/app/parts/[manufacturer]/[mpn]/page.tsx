import type { Metadata } from "next";
import { headers } from "next/headers";
import { isBot } from "@/lib/search/search-log";
import { notFound } from "next/navigation";
import { cache } from "react";
import { submitSourcingInquiry } from "@/app/inquiry/actions";
import { AvailabilityPanel } from "@/components/availability-panel";
import { InquiryForm } from "@/components/inquiry-form";
import { JsonLd } from "@/components/json-ld";
import { PartDetail } from "@/components/part-detail";
import { TrackOnMount } from "@/components/track-view";
import { consentTexts } from "@/lib/inquiry/consent";
import { loadPublishedPart } from "@/lib/parts/load-page";
import { buildDescription, buildJsonLd, buildRobots, buildTitle } from "@/lib/parts/page-model";
import { site } from "@/lib/site";

/**
 * 부품 상세 페이지 (SEO_SPEC 5장). 서버 렌더링: 핵심 콘텐츠는 JS 없이 HTML에 있다.
 * 비정규 URL 301·비게시 410은 proxy에서 처리.
 */
const load = cache(async (manufacturer: string, mpn: string) => loadPublishedPart(manufacturer, decodeURIComponent(mpn)));

export async function generateMetadata(props: PageProps<"/parts/[manufacturer]/[mpn]">): Promise<Metadata> {
  const { manufacturer, mpn } = await props.params;
  const part = await load(manufacturer, mpn);
  if (part == null) return {};
  const title = buildTitle(part);
  const description = buildDescription(part.summaryKo);
  return {
    // 명세 형식 그대로 (사이트명 접미사를 붙이지 않음)
    title: { absolute: title },
    description,
    alternates: { canonical: part.path },
    robots: buildRobots(part.indexable),
    openGraph: { type: "website", title, description, url: part.path, siteName: site.name, locale: "ko_KR" },
  };
}

export default async function PartPage(props: PageProps<"/parts/[manufacturer]/[mpn]">) {
  const { manufacturer, mpn } = await props.params;
  const part = await load(manufacturer, mpn);
  if (part == null) notFound();
  // 알려진 검색엔진 봇에는 유통사 조회를 하지 않는다 (SEO_SPEC 6.4, Mouser 일일 쿼터 보호)
  const bot = isBot((await headers()).get("user-agent"));

  return (
    <>
      <JsonLd data={buildJsonLd(part, site.url)} />
      {!bot && <TrackOnMount type="part_view" partId={part.id} />}
      <PartDetail
        part={part}
        availability={<AvailabilityPanel mpn={part.mpnDisplay} isBot={bot} partId={part.id} />}
        sourcingForm={
          <InquiryForm
            type="sourcing"
            action={submitSourcingInquiry}
            defaults={{ mpn: part.mpnDisplay, qty: "", searchLogId: "", partId: part.id }}
            consent={consentTexts()}
            compact
          />
        }
      />
    </>
  );
}
