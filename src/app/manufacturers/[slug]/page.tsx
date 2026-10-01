import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HubView } from "@/components/hub-view";
import { JsonLd } from "@/components/json-ld";
import { hubMetadata } from "@/lib/parts/hub-metadata";
import { buildHubJsonLd } from "@/lib/parts/hubs";
import { loadManufacturerHub } from "@/lib/parts/load-hubs";
import { site } from "@/lib/site";

const load = cache((slug: string, page?: string) => loadManufacturerHub(slug, page));
const pageParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(props: PageProps<"/manufacturers/[slug]">): Promise<Metadata> {
  const hub = await load((await props.params).slug, pageParam((await props.searchParams).page));
  return hub ? hubMetadata(hub) : {};
}

export default async function ManufacturerHubPage(props: PageProps<"/manufacturers/[slug]">) {
  const hub = await load((await props.params).slug, pageParam((await props.searchParams).page));
  if (!hub) notFound();
  const name = hub.title.replace(/ 부품$/, "");
  return (
    <>
      <JsonLd data={buildHubJsonLd(hub, site.url, name)} />
      <HubView hub={hub} breadcrumbName={name} />
    </>
  );
}
