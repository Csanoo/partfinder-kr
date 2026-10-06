import type { Metadata } from "next";
import { buildDescription } from "@/lib/parts/page-model";
import { pagePath, type HubModel } from "@/lib/parts/hubs";
import { siteName } from "@/lib/site";
import { localePath, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { alternatesFor, ogLocale } from "@/i18n/seo";

/** 허브 메타: 페이지별 self-canonical, 색인 기준 미달이면 noindex, follow */
export function hubMetadata(hub: HubModel, locale: Locale = "ko"): Metadata {
  const url = pagePath(hub.path, hub.page);
  const title = hub.page > 1 ? `${hub.title} ${fmt(getDictionary(locale).hub.pageSuffix, { n: hub.page })}` : hub.title;
  const description = buildDescription(hub.intro);
  return {
    title,
    description,
    alternates: alternatesFor(locale, url),
    robots: { index: hub.indexable, follow: true },
    openGraph: { type: "website", title: `${title} | ${siteName(locale)}`, description, url: localePath(locale, url), siteName: siteName(locale), locale: ogLocale(locale) },
  };
}
