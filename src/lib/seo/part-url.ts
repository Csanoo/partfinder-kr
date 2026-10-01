import { normalizeMpn } from "@/lib/search/normalize";
import { site } from "@/lib/site";

/** 품번 페이지의 정규(canonical) 경로. 정규화된 품번(대문자, 공백 제거)을 쓴다. */
export function partPath(mpn: string): string {
  return `/part/${encodeURIComponent(normalizeMpn(mpn))}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
