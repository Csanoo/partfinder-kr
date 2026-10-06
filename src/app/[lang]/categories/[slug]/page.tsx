import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HubView } from "@/components/hub-view";
import { JsonLd } from "@/components/json-ld";
import { hasLocale, type Locale } from "@/i18n/config";
import { hubMetadata } from "@/lib/parts/hub-metadata";
import { buildHubJsonLd } from "@/lib/parts/hubs";
import { loadCategoryHub } from "@/lib/parts/load-hubs";
import { site } from "@/lib/site";

const load = cache((slug: string, page: string | undefined, locale: Locale) => loadCategoryHub(slug, page, locale));
const pageParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(props: PageProps<"/[lang]/categories/[slug]">): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!hasLocale(lang)) return {};
  const hub = await load(slug, pageParam((await props.searchParams).page), lang);
  return hub ? hubMetadata(hub, lang) : {};
}

export default async function CategoryHubPage(props: PageProps<"/[lang]/categories/[slug]">) {
  const { lang, slug } = await props.params;
  if (!hasLocale(lang)) notFound();
  const hub = await load(slug, pageParam((await props.searchParams).page), lang);
  if (!hub) notFound();
  return (
    <>
      <JsonLd data={buildHubJsonLd(hub, site.url, hub.breadcrumbName, lang)} />
      <HubView hub={hub} breadcrumbName={hub.breadcrumbName} locale={lang} />
    </>
  );
}
