import { parseSitemapName, renderUrlset } from "@/lib/seo/sitemap";
import { sitemapUrls } from "@/lib/seo/sitemap-data";

export const dynamic = "force-dynamic";

/** 유형별 사이트맵: /sitemaps/{static|parts|manufacturers|categories}-{n}.xml */
export async function GET(_req: Request, ctx: RouteContext<"/sitemaps/[name]">) {
  const parsed = parseSitemapName((await ctx.params).name);
  if (!parsed) return new Response("Not Found", { status: 404 });
  const urls = await sitemapUrls(parsed.type, parsed.page);
  if (urls == null) return new Response("Not Found", { status: 404 });
  return new Response(renderUrlset(urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
