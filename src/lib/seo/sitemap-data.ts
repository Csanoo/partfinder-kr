import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { EOL_LIST_STATUSES, hubMinParts } from "@/lib/parts/hubs";
import { monthsAgo, qualityConfig } from "@/lib/parts/quality";
import { partPath } from "@/lib/parts/resolve-route";
import { absoluteUrl } from "@/lib/seo/part-url";
import { chunkCount, maxDate, sitemapChunkSize, sitemapFileName, type SitemapType, type SitemapUrl } from "@/lib/seo/sitemap";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/i18n/config";

/** 한국어 URL → 언어별 URL (화면 문구가 모두 번역된 정적·허브 페이지용) */
function inLocales(urls: SitemapUrl[], locales: readonly Locale[] = LOCALES): SitemapUrl[] {
  return urls.flatMap((u) =>
    locales.map((l) => {
      if (l === DEFAULT_LOCALE) return u;
      const url = new URL(u.loc);
      url.pathname = localePath(l, url.pathname);
      return { ...u, loc: url.toString() };
    }),
  );
}

/** 부품 사이트맵은 부품 한 개가 최대 언어 수만큼 URL 이 되므로 파일당 부품 수를 그만큼 줄인다 */
const partRowsPerChunk = () => Math.max(1, Math.floor(sitemapChunkSize() / LOCALES.length));

/**
 * 색인 대상 부품 조건.
 * 저장된 indexable 은 부품·대체품·FAQ 수정 때마다 갱신되지만, '확인일 12개월 이내'는 시간만 지나도 바뀌므로 여기서 다시 거른다.
 */
function indexablePartWhere(now = new Date()): Prisma.PartWhereInput {
  return {
    pageStatus: "published",
    indexable: true,
    lifecycleCheckedAt: { gte: monthsAgo(now, qualityConfig().lifecycleMaxAgeMonths), lte: now },
  };
}

async function partUrls(page: number): Promise<SitemapUrl[]> {
  const size = partRowsPerChunk();
  const rows = await db().part.findMany({
    where: indexablePartWhere(),
    orderBy: { id: "asc" },
    skip: (page - 1) * size,
    take: size,
    select: {
      contentUpdatedAt: true,
      manufacturer: { select: { slug: true } },
      slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
      // 번역이 있는 언어만 (번역 없는 언어 페이지는 noindex)
      translations: { select: { locale: true, updatedAt: true } },
    },
  });
  return rows
    .filter((r) => r.slugs[0])
    .flatMap((r) => {
      const path = partPath(r.manufacturer.slug, r.slugs[0].slug);
      return [
        { loc: absoluteUrl(path), lastmod: r.contentUpdatedAt },
        ...r.translations
          .filter((t) => (LOCALES as readonly string[]).includes(t.locale) && t.locale !== DEFAULT_LOCALE)
          .map((t) => ({ loc: absoluteUrl(localePath(t.locale as Locale, path)), lastmod: maxDate([r.contentUpdatedAt, t.updatedAt]) })),
      ];
    });
}

/** 게시 부품 N개 이상인 허브. lastmod = 소속 게시 부품의 최근 콘텐츠 수정 시각 */
async function hubUrls(kind: "manufacturers" | "categories"): Promise<SitemapUrl[]> {
  const min = hubMinParts();
  if (kind === "manufacturers") {
    const groups = await db().part.groupBy({
      by: ["manufacturerId"],
      where: { pageStatus: "published" },
      _count: { _all: true },
      _max: { contentUpdatedAt: true },
    });
    const eligible = groups.filter((g) => g._count._all >= min);
    const rows = await db().manufacturer.findMany({ where: { id: { in: eligible.map((g) => g.manufacturerId) } }, select: { id: true, slug: true } });
    return rows
      .map((r) => ({ loc: absoluteUrl(`/manufacturers/${r.slug}`), lastmod: eligible.find((g) => g.manufacturerId === r.id)!._max.contentUpdatedAt }))
      .sort((a, b) => a.loc.localeCompare(b.loc));
  }
  const groups = await db().part.groupBy({
    by: ["categoryId"],
    where: { pageStatus: "published", categoryId: { not: null } },
    _count: { _all: true },
    _max: { contentUpdatedAt: true },
  });
  const eligible = groups.filter((g) => g._count._all >= min);
  const rows = await db().category.findMany({ where: { id: { in: eligible.map((g) => g.categoryId!) } }, select: { id: true, slug: true } });
  return rows
    .map((r) => ({ loc: absoluteUrl(`/categories/${r.slug}`), lastmod: eligible.find((g) => g.categoryId === r.id)!._max.contentUpdatedAt }))
    .sort((a, b) => a.loc.localeCompare(b.loc));
}

async function staticUrls(): Promise<SitemapUrl[]> {
  const eol = await db().part.aggregate({
    where: { pageStatus: "published", lifecycleStatus: { in: EOL_LIST_STATUSES } },
    _count: { _all: true },
    _max: { contentUpdatedAt: true },
  });
  const urls: SitemapUrl[] = [{ loc: absoluteUrl("/") }, { loc: absoluteUrl("/request") }];
  // /eol 은 목록이 있을 때만 (빈 목록은 noindex)
  if (eol._count._all > 0) urls.push({ loc: absoluteUrl("/eol"), lastmod: eol._max.contentUpdatedAt });
  return urls;
}

/** 사이트맵 인덱스 항목. 비어 있는 유형은 넣지 않는다 (static 은 항상) */
export async function sitemapIndexEntries(): Promise<SitemapUrl[]> {
  const [partAgg, mfrs, cats, statics] = await Promise.all([
    db().part.aggregate({ where: indexablePartWhere(), _count: { _all: true }, _max: { contentUpdatedAt: true } }),
    hubUrls("manufacturers"),
    hubUrls("categories"),
    staticUrls(),
  ]);
  const entry = (type: SitemapType, page: number, lastmod: Date | null) => ({
    loc: absoluteUrl(`/sitemaps/${sitemapFileName(type, page)}`),
    lastmod,
  });
  const out: SitemapUrl[] = [entry("static", 1, maxDate(statics.map((u) => u.lastmod)))];
  for (let p = 1; p <= chunkCount(partAgg._count._all, partRowsPerChunk()); p++) out.push(entry("parts", p, partAgg._max.contentUpdatedAt));
  for (const [type, urls] of [["manufacturers", mfrs], ["categories", cats]] as const) {
    for (let p = 1; p <= chunkCount(urls.length * LOCALES.length); p++) out.push(entry(type, p, maxDate(urls.map((u) => u.lastmod))));
  }
  return out;
}

/** 유형별 사이트맵 파일. 범위 밖이면 null (404) */
export async function sitemapUrls(type: SitemapType, page: number): Promise<SitemapUrl[] | null> {
  const size = sitemapChunkSize();
  if (type === "parts") {
    const urls = await partUrls(page);
    return urls.length === 0 && page > 1 ? null : urls;
  }
  const all = inLocales(type === "static" ? await staticUrls() : await hubUrls(type));
  const slice = all.slice((page - 1) * size, page * size);
  return slice.length === 0 && page > 1 ? null : slice;
}
