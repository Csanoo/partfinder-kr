import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AvailabilityPanel } from "@/components/availability-panel";
import { JsonLd } from "@/components/json-ld";
import { PartDetail } from "@/components/part-detail";
import { RequestForm } from "@/components/request-form";
import { TrackOnMount } from "@/components/track-view";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { alternatesFor, ogLocale } from "@/i18n/seo";
import { submitPartRequest } from "@/lib/inquiry/actions";
import { consentFor } from "@/lib/inquiry/consent";
import { loadPublishedPart, translatedLocales } from "@/lib/parts/load-page";
import { buildDescription, buildJsonLd, buildRobots, buildTitle } from "@/lib/parts/page-model";
import { isBot } from "@/lib/search/search-log";
import { site, siteName } from "@/lib/site";

/**
 * 부품 상세 페이지 (SEO_SPEC 5장). 서버 렌더링: 핵심 콘텐츠는 JS 없이 HTML에 있다.
 * 비정규 URL 301·비게시 410은 proxy에서 처리.
 * 다른 언어: 번역이 있으면 번역을 보여 주고, 없으면 한국어 원문 + noindex (hreflang 에서도 제외).
 */
const load = cache(async (manufacturer: string, mpn: string, locale: Locale) => loadPublishedPart(manufacturer, decodeURIComponent(mpn), locale));

export async function generateMetadata(props: PageProps<"/[lang]/parts/[manufacturer]/[mpn]">): Promise<Metadata> {
  const { lang, manufacturer, mpn } = await props.params;
  if (!hasLocale(lang)) return {};
  const part = await load(manufacturer, mpn, lang);
  if (part == null) return {};
  const title = buildTitle(part, lang);
  const description = buildDescription(part.summaryKo);
  const available = await translatedLocales(part.id);
  return {
    // 명세 형식 그대로 (사이트명 접미사를 붙이지 않음)
    title: { absolute: title },
    description,
    alternates: alternatesFor(lang, part.path, available),
    robots: buildRobots(part.indexable && part.translation !== "missing"),
    openGraph: { type: "website", title, description, url: localePath(lang, part.path), siteName: siteName(lang), locale: ogLocale(lang) },
  };
}

export default async function PartPage(props: PageProps<"/[lang]/parts/[manufacturer]/[mpn]">) {
  const { lang, manufacturer, mpn } = await props.params;
  if (!hasLocale(lang)) notFound();
  const part = await load(manufacturer, mpn, lang);
  if (part == null) notFound();
  // 알려진 검색엔진 봇에는 유통사 조회를 하지 않는다 (SEO_SPEC 6.4, Mouser 일일 쿼터 보호)
  const bot = isBot((await headers()).get("user-agent"));
  const d = getDictionary(lang);

  return (
    <>
      <JsonLd data={buildJsonLd(part, site.url, lang)} />
      {!bot && <TrackOnMount type="part_view" partId={part.id} />}
      <PartDetail
        part={part}
        locale={lang}
        availability={<AvailabilityPanel mpn={part.mpnDisplay} isBot={bot} partId={part.id} t={d.avail} locale={lang} />}
        sourcingForm={
          <RequestForm action={submitPartRequest} defaults={{ mpn: part.mpnDisplay, partId: part.id }} consent={consentFor(lang)} t={d.form} locale={lang} compact />
        }
      />
    </>
  );
}
