import type { PrismaClient } from "@/generated/prisma/client";
import type { PageStatus } from "@/generated/prisma/enums";
import type { PartRouteHit, PartRouteRepo } from "@/lib/parts/resolve-route";
import { allocateSlug, mpnKey, slugifyMpn, slugKey } from "@/lib/parts/slug";

type Db = Pick<PrismaClient, "$transaction" | "manufacturer" | "part" | "partSlug" | "partVariant">;
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** URL 해석용 저장소 (Prisma) */
export function prismaPartRouteRepo(db: Db): PartRouteRepo {
  const toHit = (row: { partId: string; part: { pageStatus: PageStatus; slugs: { slug: string }[] } }): PartRouteHit | null => {
    const canonical = row.part.slugs[0]?.slug;
    return canonical ? { partId: row.partId, pageStatus: row.part.pageStatus, canonicalSlug: canonical } : null;
  };
  const partSelect = { pageStatus: true, slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 } } as const;

  return {
    findManufacturerBySlug: (slug) => db.manufacturer.findUnique({ where: { slug }, select: { id: true, slug: true } }),
    async findPartBySlugKey(manufacturerId, key) {
      const row = await db.partSlug.findUnique({
        where: { manufacturerId_slugKey: { manufacturerId, slugKey: key } },
        select: { partId: true, part: { select: partSelect } },
      });
      return row ? toHit(row) : null;
    },
    async findPartByVariantSlugKey(manufacturerId, key) {
      const row = await db.partVariant.findUnique({
        where: { manufacturerId_variantSlugKey: { manufacturerId, variantSlugKey: key } },
        select: { partId: true, part: { select: partSelect } },
      });
      return row ? toHit(row) : null;
    },
  };
}

async function takenSlugKeys(tx: Tx, manufacturerId: string, exceptPartId?: string): Promise<Set<string>> {
  const rows = await tx.partSlug.findMany({
    where: { manufacturerId, ...(exceptPartId ? { partId: { not: exceptPartId } } : {}) },
    select: { slugKey: true },
  });
  return new Set(rows.map((r) => r.slugKey));
}

export interface CreatePartInput {
  manufacturerId: string;
  mpnDisplay: string;
  categoryId?: string | null;
  package?: string | null;
  pageStatus?: PageStatus;
}

/**
 * 부품 생성 + 정규 slug 할당 (한 트랜잭션).
 * 같은 제조사에 mpnKey가 같은 부품이 있으면 DB 유니크 제약으로 실패한다.
 */
export async function createPart(db: Db, input: CreatePartInput): Promise<{ id: string; slug: string }> {
  return db.$transaction(async (tx) => {
    const part = await tx.part.create({
      data: {
        manufacturerId: input.manufacturerId,
        mpnDisplay: input.mpnDisplay.trim(),
        mpnKey: mpnKey(input.mpnDisplay),
        categoryId: input.categoryId ?? null,
        package: input.package ?? null,
        pageStatus: input.pageStatus ?? "draft",
      },
      select: { id: true },
    });
    const slug = allocateSlug(input.mpnDisplay, await takenSlugKeys(tx, input.manufacturerId));
    await tx.partSlug.create({
      data: { partId: part.id, manufacturerId: input.manufacturerId, slug, slugKey: slugKey(slug), isCanonical: true },
    });
    return { id: part.id, slug };
  });
}

/**
 * 품번 표기 수정. 새 slug를 정규로 만들고 이전 slug는 301용으로 남긴다.
 * (원본 표기를 "덮어쓰지 않는다"는 명세는 관리자 확인 없이 자동으로 바꾸지 않는다는 뜻으로 해석. 수정 이력은 slug에 남는다)
 * TODO(확인필요): 품번 표기 수정 자체를 허용할지
 */
export async function renamePart(db: Db, partId: string, mpnDisplay: string): Promise<{ slug: string }> {
  return db.$transaction(async (tx) => {
    const part = await tx.part.update({
      where: { id: partId },
      data: { mpnDisplay: mpnDisplay.trim(), mpnKey: mpnKey(mpnDisplay), contentUpdatedAt: new Date() },
      select: { manufacturerId: true },
    });
    const slug = allocateSlug(mpnDisplay, await takenSlugKeys(tx, part.manufacturerId, partId));
    await tx.partSlug.updateMany({ where: { partId }, data: { isCanonical: false } });
    await tx.partSlug.upsert({
      where: { manufacturerId_slug: { manufacturerId: part.manufacturerId, slug } },
      create: { partId, manufacturerId: part.manufacturerId, slug, slugKey: slugKey(slug), isCanonical: true },
      update: { isCanonical: true },
    });
    return { slug };
  });
}

/** 변형 품번 연결 (별도 페이지 없이 기준 부품으로 301) */
export async function addVariant(db: Db, partId: string, mpnVariant: string): Promise<void> {
  const part = await db.part.findUniqueOrThrow({ where: { id: partId }, select: { manufacturerId: true } });
  await db.partVariant.create({
    data: {
      partId,
      manufacturerId: part.manufacturerId,
      mpnVariant: mpnVariant.trim(),
      mpnVariantKey: mpnKey(mpnVariant),
      variantSlugKey: slugKey(slugifyMpn(mpnVariant)),
    },
  });
}
