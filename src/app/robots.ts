import type { MetadataRoute } from "next";
import { buildRobotsRules } from "@/lib/seo/robots-config";
import { absoluteUrl } from "@/lib/seo/part-url";

/** docs/SEO_SPEC.md 6.2: /admin·/search·/api 차단, AI 크롤러 허용·차단 목록, 사이트맵 인덱스 경로 */
// SITE_URL·AI 크롤러 목록을 실행 시점에 읽는다
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: buildRobotsRules(),
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
