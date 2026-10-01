import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { EOL_LIST_STATUSES, HUB_PAGE_SIZE, hubIndexable, parsePage, type HubItem, type HubModel } from "@/lib/parts/hubs";
import { partPath } from "@/lib/parts/resolve-route";
import { site } from "@/lib/site";

const itemSelect = {
  mpnDisplay: true,
  lifecycleStatus: true,
  eolDate: true,
  manufacturer: { select: { slug: true, nameEn: true } },
  category: { select: { nameKo: true } },
  slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
} satisfies Prisma.PartSelect;

type ItemRow = Prisma.PartGetPayload<{ select: typeof itemSelect }>;

function toItem(r: ItemRow): HubItem | null {
  const slug = r.slugs[0]?.slug;
  if (!slug) return null;
  return {
    mpn: r.mpnDisplay,
    path: partPath(r.manufacturer.slug, slug),
    manufacturerName: r.manufacturer.nameEn,
    categoryName: r.category?.nameKo ?? null,
    lifecycle: r.lifecycleStatus,
    eolDate: r.eolDate,
  };
}

async function listParts(where: Prisma.PartWhereInput, page: number, orderBy: Prisma.PartOrderByWithRelationInput[]) {
  const rows = await db().part.findMany({
    where: { ...where, pageStatus: "published" },
    orderBy,
    skip: (page - 1) * HUB_PAGE_SIZE,
    take: HUB_PAGE_SIZE,
    select: itemSelect,
  });
  return rows.map(toItem).filter((x): x is HubItem => x != null);
}

const countPublished = (where: Prisma.PartWhereInput) => db().part.count({ where: { ...where, pageStatus: "published" } });

/** 결과: null → 404 (없는 slug, 게시 부품 0개, 범위 밖 페이지) */
export async function loadManufacturerHub(slug: string, pageRaw?: string): Promise<HubModel | null> {
  const m = await db().manufacturer.findUnique({ where: { slug }, select: { id: true, slug: true, nameEn: true, nameKo: true, descriptionKo: true } });
  if (!m) return null;
  const where: Prisma.PartWhereInput = { manufacturerId: m.id };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (total === 0 || page == null) return null;

  const [items, cats] = await Promise.all([
    listParts(where, page, [{ mpnKey: "asc" }]),
    db().part.groupBy({ by: ["categoryId"], where: { ...where, pageStatus: "published", categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const catRows = await db().category.findMany({ where: { id: { in: cats.map((c) => c.categoryId!) } }, select: { id: true, slug: true, nameKo: true } });

  const name = m.nameKo && m.nameKo !== m.nameEn ? `${m.nameEn} (${m.nameKo})` : m.nameEn;
  return {
    kind: "manufacturer",
    title: `${name} 부품`,
    intro: m.descriptionKo?.trim() || `${site.name}에 등록된 ${m.nameEn} 부품 ${total}종의 수명주기와 대체품 정보입니다.`,
    path: `/manufacturers/${m.slug}`,
    items,
    total,
    page,
    pageCount: Math.ceil(total / HUB_PAGE_SIZE),
    indexable: hubIndexable(total),
    facets: catRows
      .map((c) => ({ label: c.nameKo, path: `/categories/${c.slug}`, count: cats.find((x) => x.categoryId === c.id)!._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function loadCategoryHub(slug: string, pageRaw?: string): Promise<HubModel | null> {
  const c = await db().category.findUnique({ where: { slug }, select: { id: true, slug: true, nameEn: true, nameKo: true, descriptionKo: true } });
  if (!c) return null;
  const where: Prisma.PartWhereInput = { categoryId: c.id };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (total === 0 || page == null) return null;

  const [items, mfrs] = await Promise.all([
    listParts(where, page, [{ mpnKey: "asc" }]),
    db().part.groupBy({ by: ["manufacturerId"], where: { ...where, pageStatus: "published" }, _count: { _all: true } }),
  ]);
  const mfrRows = await db().manufacturer.findMany({ where: { id: { in: mfrs.map((x) => x.manufacturerId) } }, select: { id: true, slug: true, nameEn: true } });

  return {
    kind: "category",
    title: `${c.nameKo} 부품`,
    intro: c.descriptionKo?.trim() || `${site.name}에 등록된 ${c.nameKo}(${c.nameEn}) 부품 ${total}종의 수명주기와 대체품 정보입니다.`,
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
export async function loadEolHub(pageRaw?: string): Promise<HubModel | null> {
  const where: Prisma.PartWhereInput = { lifecycleStatus: { in: EOL_LIST_STATUSES } };
  const total = await countPublished(where);
  const page = parsePage(pageRaw, total);
  if (page == null) return null;
  const items = total === 0 ? [] : await listParts(where, page, [{ eolDate: { sort: "asc", nulls: "last" } }, { mpnKey: "asc" }]);
  return {
    kind: "eol",
    title: "단종·수급 주의 부품 목록",
    intro: `제조사가 단종(EOL)·최종 구매(LTB)·신규 설계 비권장(NRND)으로 발표한 부품 ${total}종입니다. 상태는 각 부품 페이지의 확인일과 출처를 기준으로 합니다.`,
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
