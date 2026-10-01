import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/part-url";

/**
 * 사이트맵.
 * TODO: SEO 명세 9장 5단계에서 사이트맵 인덱스 + 유형별 분할(parts/manufacturers/categories), indexable 페이지만 포함
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 }];
}
