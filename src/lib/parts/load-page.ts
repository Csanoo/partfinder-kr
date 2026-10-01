import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { PartPageModel } from "@/lib/parts/page-model";
import { evaluateQuality } from "@/lib/parts/quality";
import { partPath } from "@/lib/parts/resolve-route";

const RELATED_LIMIT = 10;

const partInclude = {
  manufacturer: { select: { id: true, slug: true, nameEn: true, nameKo: true } },
  category: { select: { id: true, slug: true, nameKo: true, nameEn: true } },
  slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
  alternatives: {
    orderBy: [{ verified: "desc" }, { createdAt: "asc" }],
    include: {
      altPart: {
        select: {
          mpnDisplay: true,
          pageStatus: true,
          manufacturer: { select: { slug: true, nameEn: true } },
          slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
        },
      },
    },
  },
  faqs: { where: { published: true }, orderBy: { createdAt: "asc" }, select: { questionKo: true, answerKo: true } },
} satisfies Prisma.PartInclude;

type PartRow = Prisma.PartGetPayload<{ include: typeof partInclude }>;

async function toModel(part: PartRow): Promise<PartPageModel> {
  const keySpecs = Array.isArray(part.keySpecs)
    ? (part.keySpecs as { label?: unknown; value?: unknown }[])
        .filter((s) => typeof s?.label === "string" && typeof s?.value === "string")
        .map((s) => ({ label: s.label as string, value: s.value as string }))
    : [];

  // 관련 부품: 같은 카테고리 또는 같은 제조사의 게시 부품 (색인 가능 우선)
  const related = await db().part.findMany({
    where: {
      id: { not: part.id },
      pageStatus: "published",
      OR: [...(part.categoryId ? [{ categoryId: part.categoryId }] : []), { manufacturerId: part.manufacturerId }],
    },
    orderBy: [{ indexable: "desc" }, { contentUpdatedAt: "desc" }],
    take: RELATED_LIMIT,
    select: {
      mpnDisplay: true,
      manufacturer: { select: { slug: true, nameEn: true } },
      slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 },
    },
  });

  // 색인 여부는 저장값이 아니라 지금 기준으로 다시 계산 (확인일 경과처럼 시간만 지나도 바뀜)
  const quality = evaluateQuality({
    pageStatus: part.pageStatus,
    reviewedBy: part.reviewedBy,
    summaryKo: part.summaryKo,
    lifecycleStatus: part.lifecycleStatus,
    lifecycleCheckedAt: part.lifecycleCheckedAt,
    eolDate: part.eolDate,
    keySpecs,
    verifiedAlternativeCount: part.alternatives.filter((a) => a.verified).length,
    publishedFaqCount: part.faqs.length,
  });

  return {
    mpnDisplay: part.mpnDisplay,
    manufacturer: { slug: part.manufacturer.slug, nameEn: part.manufacturer.nameEn, nameKo: part.manufacturer.nameKo },
    category: part.category ? { slug: part.category.slug, nameKo: part.category.nameKo, nameEn: part.category.nameEn } : null,
    package: part.package,
    summaryKo: part.summaryKo,
    keySpecs,
    lifecycle: {
      status: part.lifecycleStatus,
      checkedAt: part.lifecycleCheckedAt,
      source: part.lifecycleSource,
      eolDate: part.eolDate,
    },
    datasheetUrl: part.datasheetUrl,
    alternatives: part.alternatives.map((a) => {
      const alt = a.altPart;
      const altSlug = alt?.slugs[0]?.slug;
      return {
        mpn: alt?.mpnDisplay ?? a.altMpnText ?? "",
        manufacturerName: alt?.manufacturer.nameEn ?? null,
        path: alt && alt.pageStatus === "published" && altSlug ? partPath(alt.manufacturer.slug, altSlug) : null,
        relation: a.relation,
        noteKo: a.noteKo,
        verified: a.verified,
      };
    }),
    faqs: part.faqs,
    related: related
      .filter((r) => r.slugs[0])
      .map((r) => ({ mpn: r.mpnDisplay, manufacturerName: r.manufacturer.nameEn, path: partPath(r.manufacturer.slug, r.slugs[0].slug) })),
    path: partPath(part.manufacturer.slug, part.slugs[0]?.slug ?? ""),
    indexable: quality.indexable,
  };
}

/** 공개 페이지: 정규 slug + 게시 상태만 (비정규 URL·410은 proxy에서 처리) */
export async function loadPublishedPart(manufacturerSlug: string, mpnSlug: string): Promise<PartPageModel | null> {
  const row = await db().partSlug.findFirst({
    where: { slug: mpnSlug, isCanonical: true, manufacturer: { slug: manufacturerSlug }, part: { pageStatus: "published" } },
    select: { part: { include: partInclude } },
  });
  return row ? toModel(row.part) : null;
}

/** 관리자 미리보기: 상태 무관 */
export async function loadPartById(partId: string): Promise<PartPageModel | null> {
  const part = await db().part.findUnique({ where: { id: partId }, include: partInclude });
  return part ? toModel(part) : null;
}
