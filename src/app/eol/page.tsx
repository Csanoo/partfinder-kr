import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HubView } from "@/components/hub-view";
import { JsonLd } from "@/components/json-ld";
import { hubMetadata } from "@/lib/parts/hub-metadata";
import { buildHubJsonLd } from "@/lib/parts/hubs";
import { loadEolHub } from "@/lib/parts/load-hubs";
import { site } from "@/lib/site";

const load = cache((page?: string) => loadEolHub(page));
const pageParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(props: PageProps<"/eol">): Promise<Metadata> {
  const hub = await load(pageParam((await props.searchParams).page));
  return hub ? hubMetadata(hub) : {};
}

export default async function EolPage(props: PageProps<"/eol">) {
  const hub = await load(pageParam((await props.searchParams).page));
  if (!hub) notFound();
  return (
    <>
      <JsonLd data={buildHubJsonLd(hub, site.url, "단종 부품")} />
      <HubView hub={hub} breadcrumbName="단종 부품" />
    </>
  );
}
