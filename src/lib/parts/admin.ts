import type { Prisma } from "@/generated/prisma/client";
import type { AltRelation, PageStatus, PartLifecycle } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { ImportPlan } from "@/lib/parts/import-plan";
import { evaluateQuality, type QualityResult } from "@/lib/parts/quality";
import { addVariant, createPart, renamePart } from "@/lib/parts/service";
import { mpnKey, slugifyName } from "@/lib/parts/slug";

/** 일괄 게시 상한 (SEO_SPEC 7장) */
export const BULK_PUBLISH_LIMIT = 50;

type Tx = Prisma.TransactionClient;

async function qualityOf(tx: Tx, partId: string, now = new Date()): Promise<QualityResult> {
  const part = await tx.part.findUniqueOrThrow({
    where: { id: partId },
    select: {
      pageStatus: true,
      reviewedBy: true,
      summaryKo: true,
      lifecycleStatus: true,
      lifecycleCheckedAt: true,
      eolDate: true,
      keySpecs: true,
      _count: {
        select: {
          alternatives: { where: { verified: true } },
          faqs: { where: { published: true } },
        },
      },
    },
  });
  return evaluateQuality(
    {
      pageStatus: part.pageStatus,
      reviewedBy: part.reviewedBy,
      summaryKo: part.summaryKo,
      lifecycleStatus: part.lifecycleStatus,
      lifecycleCheckedAt: part.lifecycleCheckedAt,
      eolDate: part.eolDate,
      keySpecs: Array.isArray(part.keySpecs) ? (part.keySpecs as { label: string; value: string }[]) : [],
      verifiedAlternativeCount: part._count.alternatives,
      publishedFaqCount: part._count.faqs,
    },
    now,
  );
}

/** indexable 재계산 후 저장. 부품·대체품·FAQ가 바뀔 때마다 호출한다. */
export async function recomputeIndexable(tx: Tx, partId: string): Promise<QualityResult> {
  const q = await qualityOf(tx, partId);
  await tx.part.update({ where: { id: partId }, data: { indexable: q.indexable } });
  return q;
}

/**
 * 전체 재계산. 확인일 12개월 경과처럼 시간만 지나도 바뀌는 기준이 있어 주기 실행이 필요하다.
 * TODO(확인필요): 배포 환경의 스케줄러(cron)로 하루 1회 실행
 */
export async function recomputeAllIndexable(): Promise<number> {
  const ids = await db().part.findMany({ select: { id: true } });
  for (const { id } of ids) await db().$transaction((tx) => recomputeIndexable(tx, id));
  return ids.length;
}

export async function getQuality(partId: string): Promise<QualityResult> {
  return db().$transaction((tx) => qualityOf(tx, partId));
}

export interface PartFields {
  categoryId: string | null;
  package: string | null;
  summaryKo: string | null;
  keySpecs: { label: string; value: string }[];
  lifecycleStatus: PartLifecycle;
  lifecycleCheckedAt: Date | null;
  lifecycleSource: string | null;
  eolDate: Date | null;
  datasheetUrl: string | null;
}

export async function updatePart(partId: string, fields: PartFields, mpnDisplay?: string): Promise<void> {
  const current = await db().part.findUniqueOrThrow({ where: { id: partId }, select: { mpnDisplay: true } });
  if (mpnDisplay && mpnDisplay.trim() !== current.mpnDisplay) await renamePart(db(), partId, mpnDisplay);
  await db().$transaction(async (tx) => {
    await tx.part.update({
      where: { id: partId },
      data: { ...fields, keySpecs: fields.keySpecs as Prisma.InputJsonValue, contentUpdatedAt: new Date() },
    });
    await recomputeIndexable(tx, partId);
  });
}

/** 검토 완료 기록 */
export async function markReviewed(partId: string, adminName: string): Promise<void> {
  await db().$transaction(async (tx) => {
    await tx.part.update({ where: { id: partId }, data: { reviewedBy: adminName, reviewedAt: new Date() } });
    await recomputeIndexable(tx, partId);
  });
}

export async function setPageStatus(partId: string, status: PageStatus): Promise<void> {
  await db().$transaction(async (tx) => {
    const now = new Date();
    await tx.part.update({
      where: { id: partId },
      data: { pageStatus: status, ...(status === "published" ? { publishedAt: now } : {}) },
    });
    await recomputeIndexable(tx, partId);
  });
}

/** 일괄 게시. 상한 초과면 아무것도 하지 않고 오류 */
export async function bulkPublish(partIds: string[]): Promise<{ published: number }> {
  const ids = [...new Set(partIds)];
  if (ids.length === 0) return { published: 0 };
  if (ids.length > BULK_PUBLISH_LIMIT) throw new Error(`한 번에 ${BULK_PUBLISH_LIMIT}건까지 게시할 수 있습니다.`);
  for (const id of ids) await setPageStatus(id, "published");
  return { published: ids.length };
}

// ── 대체품 ──

export async function addAlternative(
  partId: string,
  input: { altMpn: string; relation: AltRelation; noteKo: string | null },
): Promise<void> {
  const part = await db().part.findUniqueOrThrow({ where: { id: partId }, select: { manufacturerId: true } });
  // 내부 페이지가 있으면 연결 (같은 제조사 우선, 없으면 다른 제조사). 없으면 품번 텍스트로 저장
  const key = mpnKey(input.altMpn);
  const internal =
    (await db().part.findFirst({
      where: { mpnKey: key, manufacturerId: part.manufacturerId, id: { not: partId } },
      select: { id: true },
    })) ??
    (await db().part.findFirst({ where: { mpnKey: key, id: { not: partId } }, select: { id: true } }));
  await db().$transaction(async (tx) => {
    await tx.partAlternative.create({
      data: {
        partId,
        altPartId: internal?.id ?? null,
        altMpnText: internal ? null : input.altMpn.trim(),
        relation: input.relation,
        noteKo: input.noteKo,
      },
    });
    await recomputeIndexable(tx, partId);
  });
}

export async function setAlternativeVerified(altId: string, verified: boolean, adminName: string): Promise<void> {
  await db().$transaction(async (tx) => {
    const alt = await tx.partAlternative.update({
      where: { id: altId },
      data: { verified, verifiedBy: verified ? adminName : null },
      select: { partId: true },
    });
    await recomputeIndexable(tx, alt.partId);
  });
}

export async function removeAlternative(altId: string): Promise<void> {
  await db().$transaction(async (tx) => {
    const alt = await tx.partAlternative.delete({ where: { id: altId }, select: { partId: true } });
    await recomputeIndexable(tx, alt.partId);
  });
}

// ── FAQ ──

export async function addFaq(partId: string, input: { questionKo: string; answerKo: string }): Promise<void> {
  await db().partFaq.create({ data: { partId, ...input, source: "manual", published: false } });
}

export async function setFaqPublished(faqId: string, published: boolean): Promise<void> {
  await db().$transaction(async (tx) => {
    const faq = await tx.partFaq.update({ where: { id: faqId }, data: { published }, select: { partId: true } });
    await tx.part.update({ where: { id: faq.partId }, data: { contentUpdatedAt: new Date() } });
    await recomputeIndexable(tx, faq.partId);
  });
}

export async function removeFaq(faqId: string): Promise<void> {
  await db().$transaction(async (tx) => {
    const faq = await tx.partFaq.delete({ where: { id: faqId }, select: { partId: true } });
    await recomputeIndexable(tx, faq.partId);
  });
}

// ── 변형 품번 ──

export async function addPartVariant(partId: string, mpnVariant: string): Promise<void> {
  await addVariant(db(), partId, mpnVariant);
}

export async function removePartVariant(variantId: string): Promise<void> {
  await db().partVariant.delete({ where: { id: variantId } });
}

// ── 부품 생성·가져오기 ──

export async function createDraftPart(input: {
  manufacturerId: string;
  mpnDisplay: string;
  categoryId: string | null;
  package: string | null;
}): Promise<{ id: string }> {
  const { id } = await createPart(db(), { ...input, pageStatus: "draft" });
  return { id };
}

/** CSV 가져오기 실행: 새 제조사 생성 후 부품을 draft로 생성 */
export async function executeImport(plan: ImportPlan): Promise<{ created: number; failed: { line: number; message: string }[] }> {
  for (const [slug, name] of plan.newManufacturers) {
    await db().manufacturer.upsert({ where: { slug }, create: { slug, nameEn: name, nameKo: name }, update: {} });
  }
  const mfrs = new Map((await db().manufacturer.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]));
  const cats = new Map((await db().category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));

  let created = 0;
  const failed: { line: number; message: string }[] = [];
  for (const row of plan.create) {
    try {
      const manufacturerId = mfrs.get(row.manufacturerSlug);
      if (!manufacturerId) throw new Error(`제조사 없음: ${row.manufacturerSlug}`);
      const { id } = await createPart(db(), {
        manufacturerId,
        mpnDisplay: row.mpn,
        categoryId: row.categorySlug ? (cats.get(row.categorySlug) ?? null) : null,
        package: row.package,
        pageStatus: "draft",
      });
      await db().part.update({
        where: { id },
        data: {
          lifecycleStatus: row.lifecycleStatus,
          eolDate: row.eolDate,
          lifecycleCheckedAt: row.lifecycleCheckedAt,
          lifecycleSource: row.lifecycleSource,
          datasheetUrl: row.datasheetUrl,
        },
      });
      created++;
    } catch (err) {
      failed.push({ line: row.line, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { created, failed };
}

/** CSV 계획에 필요한 기존 데이터 색인 */
export async function loadImportIndex() {
  const [mfrs, cats, parts] = await Promise.all([
    db().manufacturer.findMany({ select: { slug: true, nameEn: true, nameKo: true } }),
    db().category.findMany({ select: { slug: true, nameEn: true, nameKo: true } }),
    db().part.findMany({ select: { mpnKey: true, manufacturer: { select: { slug: true } } } }),
  ]);
  const lookup = (rows: { slug: string; nameEn: string; nameKo: string }[]) => {
    const m = new Map<string, string>();
    for (const r of rows) for (const k of [r.slug, r.nameEn, r.nameKo, slugifyName(r.nameEn)]) m.set(k.trim().toLowerCase(), r.slug);
    return m;
  };
  return {
    manufacturers: lookup(mfrs),
    categories: lookup(cats),
    partKeys: new Set(parts.map((p) => `${p.manufacturer.slug}|${p.mpnKey}`)),
  };
}
