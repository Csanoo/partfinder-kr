import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HubView } from "@/components/hub-view";
import { JsonLd } from "@/components/json-ld";
import { hasLocale, type Locale } from "@/i18n/config";
import { hubMetadata } from "@/lib/parts/hub-metadata";
import { buildHubJsonLd } from "@/lib/parts/hubs";
import { loadEolHub } from "@/lib/parts/load-hubs";
import { site } from "@/lib/site";

const load = cache((page: string | undefined, locale: Locale) => loadEolHub(page, locale));
const pageParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(props: PageProps<"/[lang]/eol">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!hasLocale(lang)) return {};
  const hub = await load(pageParam((await props.searchParams).page), lang);
  return hub ? hubMetadata(hub, lang) : {};
}

export default async function EolPage(props: PageProps<"/[lang]/eol">) {
  const { lang } = await props.params;
  if (!hasLocale(lang)) notFound();
  const hub = await load(pageParam((await props.searchParams).page), lang);
  if (!hub) notFound();
  return (
    <>
      <JsonLd data={buildHubJsonLd(hub, site.url, hub.breadcrumbName, lang)} />
      <HubView hub={hub} breadcrumbName={hub.breadcrumbName} locale={lang} />
    </>
  );
}
