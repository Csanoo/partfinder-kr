import { renderIndex } from "@/lib/seo/sitemap";
import { sitemapIndexEntries } from "@/lib/seo/sitemap-data";

export const dynamic = "force-dynamic";

/** 사이트맵 인덱스 */
export async function GET() {
  const xml = renderIndex(await sitemapIndexEntries());
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
