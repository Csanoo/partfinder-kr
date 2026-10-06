import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { EOL_LIST_STATUSES, HUB_PAGE_SIZE, hubIndexable, parsePage, type HubItem, type HubModel } from "@/lib/parts/hubs";
import { partPath } from "@/lib/parts/resolve-route";
import { siteName } from "@/lib/site";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";

const itemSelect = {
  mpnDisplay: true,
  lifecycleStatus: true,
  eolDate: true,
  manufacturer: { select: { slug: true, nameEn: true } },
  category: { select: { nameKo: true, nameEn: true } },
  slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
} satisfies Prisma.PartSelect;

type ItemRow = Prisma.PartGetPayload<{ select: typeof itemSelect }>;

function toItem(r: ItemRow, locale: Locale): HubItem | null {
  const slug = r.slugs[0]?.slug;
  if (!slug) return null;
  return {
    mpn: r.mpnDisplay,
    path: partPath(r.manufacturer.slug, slug),
    manufacturerName: r.manufacturer.nameEn,
    categoryName: (locale === "ko" ? r.category?.nameKo : r.category?.nameEn) ?? null,
    lifecycle: r.lifecycleStatus,
    eolDate: r.eolDate,
  };
}

async function listParts(where: Prisma.PartWhereInput, page: number, orderBy: Prisma.PartOrderByWithRelationInput[], locale: Locale) {
  const rows = await db().part.findMany({
    where: { ...where, pageStatus: "published" },
    orderBy,
    skip: (page - 1) * HUB_PAGE_SIZE,
    take: HUB_PAGE_SIZE,
    select: itemSelect,
  });
  return rows.map((r) => toItem(r, locale)).filter((x): x is HubItem => x != null);
}

const countPublished = (where: Prisma.PartWhereInput) => db().part.count({ where: { ...where, pageStatus: "published" } });

/** 결과: null → 404 (없는 slug, 게시 부품 0개, 범위 밖 페이지) */
export async function loadManufacturerHub(slug: string, pageRaw?: string, locale: Locale = DEFAULT_LOCALE): Promise<HubModel | null> {
  const t = getDictionary(locale).hub;
  const m = await db().manufacturer.findUnique({ where: { slug }, select: { id: true, slug: true, nameEn: true, nameKo: true, descriptionKo: true } });
  if (!m) return null;
  const where: Prisma.PartWhereInput = { manufacturerId: m.id };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (total === 0 || page == null) return null;

  const [items, cats] = await Promise.all([
    listParts(where, page, [{ mpnKey: "asc" }], locale),
    db().part.groupBy({ by: ["categoryId"], where: { ...where, pageStatus: "published", categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const catRows = await db().category.findMany({ where: { id: { in: cats.map((c) => c.categoryId!) } }, select: { id: true, slug: true, nameKo: true, nameEn: true } });

  const name = locale === "ko" && m.nameKo && m.nameKo !== m.nameEn ? `${m.nameEn} (${m.nameKo})` : m.nameEn;
  return {
    kind: "manufacturer",
    title: fmt(t.mfrTitle, { name }),
    // 관리자 입력 설명(description_ko)은 한국어 화면에서만
    intro: (locale === "ko" && m.descriptionKo?.trim()) || fmt(t.mfrIntro, { site: siteName(locale), name: m.nameEn, n: total }),
    breadcrumbName: name,
    path: `/manufacturers/${m.slug}`,
    items,
    total,
    page,
    pageCount: Math.ceil(total / HUB_PAGE_SIZE),
    indexable: hubIndexable(total),
    facets: catRows
      .map((c) => ({ label: locale === "ko" ? c.nameKo : c.nameEn, path: `/categories/${c.slug}`, count: cats.find((x) => x.categoryId === c.id)!._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function loadCategoryHub(slug: string, pageRaw?: string, locale: Locale = DEFAULT_LOCALE): Promise<HubModel | null> {
  const t = getDictionary(locale).hub;
  const c = await db().category.findUnique({ where: { slug }, select: { id: true, slug: true, nameEn: true, nameKo: true, descriptionKo: true } });
  if (!c) return null;
  const where: Prisma.PartWhereInput = { categoryId: c.id };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (total === 0 || page == null) return null;

  const [items, mfrs] = await Promise.all([
    listParts(where, page, [{ mpnKey: "asc" }], locale),
    db().part.groupBy({ by: ["manufacturerId"], where: { ...where, pageStatus: "published" }, _count: { _all: true } }),
  ]);
  const mfrRows = await db().manufacturer.findMany({ where: { id: { in: mfrs.map((x) => x.manufacturerId) } }, select: { id: true, slug: true, nameEn: true } });

  return {
    kind: "category",
    title: locale === "ko" ? `${c.nameKo} 부품` : fmt(t.catTitle, { name: c.nameEn }),
    intro:
      (locale === "ko" && c.descriptionKo?.trim()) ||
      fmt(t.catIntro, { site: siteName(locale), name: locale === "ko" ? `${c.nameKo}(${c.nameEn})` : c.nameEn, n: total }),
    breadcrumbName: locale === "ko" ? c.nameKo : c.nameEn,
    path: `/categories/${c.slug}`,
    items,
    total,
    page,
    pageCount: Math.ceil(total / HUB_PAGE_SIZE),
    indexable: hubIndexable(total),
    facets: mfrRows
      .map((m) => ({ label: m.nameEn, path: `/manufacturers/${m.slug}`, count: mfrs.find((x) => x.manufacturerId === m.id)!._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

/** /eol: 게시된 단종·LTB·NRND 부품. 단종일 가까운 순 → 품번 순 */
export async function loadEolHub(pageRaw?: string, locale: Locale = DEFAULT_LOCALE): Promise<HubModel | null> {
  const t = getDictionary(locale).hub;
  const where: Prisma.PartWhereInput = { lifecycleStatus: { in: EOL_LIST_STATUSES } };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (page == null) return null;
  const items = total === 0 ? [] : await listParts(where, page, [{ eolDate: { sort: "asc", nulls: "last" } }, { mpnKey: "asc" }], locale);
  return {
    kind: "eol",
    title: t.eolTitle,
    intro: fmt(t.eolIntro, { n: total }),
    breadcrumbName: t.eolBreadcrumb,
    path: "/eol",
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / HUB_PAGE_SIZE)),
    // 명세상 /eol 은 색인 대상. 다만 게시 부품이 0개인 빈 목록은 얇은 페이지라 noindex
    indexable: total > 0,
    facets: [],
  };
}
