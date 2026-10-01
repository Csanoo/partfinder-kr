import type { MetadataRoute } from "next";
import { normalizeMpn } from "@/lib/search/normalize";
import { absoluteUrl, partPath } from "@/lib/seo/part-url";

/**
 * 사이트맵.
 * 품번 목록은 현재 환경변수 SEO_SEED_MPNS(쉼표 구분)에서 읽는다.
 * TODO: DB 연결(3단계) 후 search_log 인기 품번(결과 있는 것)으로 자동 생성
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const seeds = (process.env.SEO_SEED_MPNS ?? "")
    .split(",")
    .map((s) => normalizeMpn(s))
    .filter(Boolean);

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...[...new Set(seeds)].map((mpn) => ({
      url: absoluteUrl(partPath(mpn)),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
