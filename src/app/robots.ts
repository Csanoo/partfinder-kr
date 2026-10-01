import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/part-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /search 는 noindex 메타로 처리하므로 막지 않는다 (막으면 noindex를 읽지 못함).
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
