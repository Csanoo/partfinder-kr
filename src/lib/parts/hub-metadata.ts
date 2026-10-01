import type { Metadata } from "next";
import { buildDescription } from "@/lib/parts/page-model";
import { pagePath, type HubModel } from "@/lib/parts/hubs";
import { site } from "@/lib/site";

/** 허브 메타: 페이지별 self-canonical, 색인 기준 미달이면 noindex, follow */
export function hubMetadata(hub: HubModel): Metadata {
  const url = pagePath(hub.path, hub.page);
  const title = hub.page > 1 ? `${hub.title} (${hub.page}페이지)` : hub.title;
  const description = buildDescription(hub.intro);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: hub.indexable, follow: true },
    openGraph: { type: "website", title: `${title} | ${site.name}`, description, url, siteName: site.name, locale: "ko_KR" },
  };
}
