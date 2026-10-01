/**
 * 사이트맵 (docs/SEO_SPEC.md 6.2)
 * - /sitemap.xml: 사이트맵 인덱스
 * - /sitemaps/{type}-{n}.xml: 유형별 분할 (static, parts, manufacturers, categories), 파일당 URL 50,000개 이하
 * - 색인 대상(indexable) 페이지만, lastmod 는 실제 콘텐츠 수정 시각
 */

export const SITEMAP_TYPES = ["static", "parts", "manufacturers", "categories"] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

/** 구글 한도 50,000. 테스트·운영 조정용 환경변수 */
export function sitemapChunkSize(): number {
  const v = Number(process.env.SITEMAP_CHUNK_SIZE);
  return Number.isInteger(v) && v > 0 && v <= 50_000 ? v : 50_000;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: Date | null;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const iso = (d: Date) => d.toISOString();

export function renderUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${iso(u.lastmod)}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderIndex(entries: SitemapUrl[]): string {
  const body = entries
    .map((e) => `<sitemap><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${iso(e.lastmod)}</lastmod>` : ""}</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** "parts-2.xml" → { type: "parts", page: 2 }. 형식이 틀리면 null */
export function parseSitemapName(name: string): { type: SitemapType; page: number } | null {
  const m = /^([a-z]+)-(\d+)\.xml$/.exec(name);
  if (!m || !(SITEMAP_TYPES as readonly string[]).includes(m[1])) return null;
  const page = Number(m[2]);
  return page >= 1 ? { type: m[1] as SitemapType, page } : null;
}

export function sitemapFileName(type: SitemapType, page: number): string {
  return `${type}-${page}.xml`;
}

export function chunkCount(total: number, size = sitemapChunkSize()): number {
  return Math.ceil(total / size);
}

export function maxDate(dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}
