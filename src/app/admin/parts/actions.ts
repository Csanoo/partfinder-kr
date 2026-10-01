"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AltRelation, PageStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  addAlternative,
  addFaq,
  addPartVariant,
  bulkPublish,
  createDraftPart,
  executeImport,
  loadImportIndex,
  markReviewed,
  removeAlternative,
  removeFaq,
  removePartVariant,
  setAlternativeVerified,
  setFaqPublished,
  setPageStatus,
  updatePart,
} from "@/lib/parts/admin";
import { planImport, type ImportPlan } from "@/lib/parts/import-plan";
import { slugifyName } from "@/lib/parts/slug";
import { parseDateOnly, parseKeySpecs, parseLifecycle, validateDatasheetUrl } from "@/lib/parts/validate-part";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const orNull = (s: string) => (s === "" ? null : s);

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err != null && "code" in err && (err as { code: string }).code === "P2002";
}

// ── 부품 생성·수정 ──

export async function createPartAction(fd: FormData) {
  await requireAdmin();
  const mpn = str(fd, "mpnDisplay");
  const manufacturerId = str(fd, "manufacturerId");
  if (!mpn || !manufacturerId) back("/admin/parts/new", { error: "품번과 제조사는 필수입니다." });
  let id: string;
  try {
    ({ id } = await createDraftPart({
      mpnDisplay: mpn,
      manufacturerId,
      categoryId: orNull(str(fd, "categoryId")),
      package: orNull(str(fd, "package")),
    }));
  } catch (err) {
    if (isUniqueViolation(err)) back("/admin/parts/new", { error: "같은 제조사에 이미 등록된 품번입니다 (대소문자·공백·하이픈 무시)." });
    throw err;
  }
  redirect(`/admin/parts/${id}?saved=1`);
}

export async function updatePartAction(partId: string, fd: FormData) {
  await requireAdmin();
  const path = `/admin/parts/${partId}`;
  const lifecycle = parseLifecycle(str(fd, "lifecycleStatus"));
  const checked = parseDateOnly(str(fd, "lifecycleCheckedAt"));
  const eol = parseDateOnly(str(fd, "eolDate"));
  const datasheet = validateDatasheetUrl(str(fd, "datasheetUrl"));
  const errors = [
    lifecycle == null && "수명주기 값이 올바르지 않습니다.",
    !checked.ok && `확인일: ${checked.error}`,
    !eol.ok && `단종일: ${eol.error}`,
    !datasheet.ok && `데이터시트: ${datasheet.error}`,
  ].filter(Boolean);
  if (errors.length > 0) back(path, { error: errors.join(" ") });

  try {
    await updatePart(
      partId,
      {
        categoryId: orNull(str(fd, "categoryId")),
        package: orNull(str(fd, "package")),
        summaryKo: orNull(str(fd, "summaryKo")),
        keySpecs: parseKeySpecs(str(fd, "keySpecs")),
        lifecycleStatus: lifecycle!,
        lifecycleCheckedAt: checked.ok ? checked.date : null,
        lifecycleSource: orNull(str(fd, "lifecycleSource")),
        eolDate: eol.ok ? eol.date : null,
        datasheetUrl: datasheet.ok ? datasheet.url : null,
      },
      str(fd, "mpnDisplay") || undefined,
    );
  } catch (err) {
    if (isUniqueViolation(err)) back(path, { error: "같은 제조사에 이미 같은 품번이 있습니다." });
    throw err;
  }
  revalidatePath(path);
  back(path, { saved: "1" });
}

export async function markReviewedAction(partId: string) {
  const admin = await requireAdmin();
  await markReviewed(partId, admin);
  revalidatePath(`/admin/parts/${partId}`);
}

export async function setStatusAction(partId: string, status: PageStatus) {
  await requireAdmin();
  await setPageStatus(partId, status);
  revalidatePath(`/admin/parts/${partId}`);
  revalidatePath("/admin/parts");
}

export async function bulkPublishAction(fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll("ids").filter((v): v is string => typeof v === "string");
  try {
    const { published } = await bulkPublish(ids);
    revalidatePath("/admin/parts");
    back("/admin/parts", { message: `${published}건 게시했습니다.` });
  } catch (err) {
    if (err instanceof Error && err.message.includes("까지 게시")) back("/admin/parts", { error: err.message });
    throw err;
  }
}

// ── 대체품·FAQ·변형 품번 ──

const RELATIONS: AltRelation[] = ["drop_in", "similar", "upgrade"];

export async function addAlternativeAction(partId: string, fd: FormData) {
  await requireAdmin();
  const altMpn = str(fd, "altMpn");
  const relation = str(fd, "relation") as AltRelation;
  if (!altMpn || !RELATIONS.includes(relation)) back(`/admin/parts/${partId}`, { error: "대체 품번과 관계 유형을 입력해 주세요." });
  await addAlternative(partId, { altMpn, relation, noteKo: orNull(str(fd, "noteKo")) });
  revalidatePath(`/admin/parts/${partId}`);
}

export async function setAlternativeVerifiedAction(partId: string, altId: string, verified: boolean) {
  const admin = await requireAdmin();
  await setAlternativeVerified(altId, verified, admin);
  revalidatePath(`/admin/parts/${partId}`);
}

export async function removeAlternativeAction(partId: string, altId: string) {
  await requireAdmin();
  await removeAlternative(altId);
  revalidatePath(`/admin/parts/${partId}`);
}

export async function addFaqAction(partId: string, fd: FormData) {
  await requireAdmin();
  const questionKo = str(fd, "questionKo");
  const answerKo = str(fd, "answerKo");
  if (!questionKo || !answerKo) back(`/admin/parts/${partId}`, { error: "질문과 답변을 입력해 주세요." });
  await addFaq(partId, { questionKo, answerKo });
  revalidatePath(`/admin/parts/${partId}`);
}

export async function setFaqPublishedAction(partId: string, faqId: string, published: boolean) {
  await requireAdmin();
  await setFaqPublished(faqId, published);
  revalidatePath(`/admin/parts/${partId}`);
}

export async function removeFaqAction(partId: string, faqId: string) {
  await requireAdmin();
  await removeFaq(faqId);
  revalidatePath(`/admin/parts/${partId}`);
}

export async function addVariantAction(partId: string, fd: FormData) {
  await requireAdmin();
  const v = str(fd, "mpnVariant");
  if (!v) back(`/admin/parts/${partId}`, { error: "변형 품번을 입력해 주세요." });
  try {
    await addPartVariant(partId, v);
  } catch (err) {
    if (isUniqueViolation(err)) back(`/admin/parts/${partId}`, { error: "이미 다른 부품에 연결된 변형 품번입니다." });
    throw err;
  }
  revalidatePath(`/admin/parts/${partId}`);
}

export async function removeVariantAction(partId: string, variantId: string) {
  await requireAdmin();
  await removePartVariant(variantId);
  revalidatePath(`/admin/parts/${partId}`);
}

// ── 제조사·카테고리 ──

export async function createTaxonomyAction(kind: "manufacturer" | "category", fd: FormData) {
  await requireAdmin();
  const nameEn = str(fd, "nameEn");
  const nameKo = str(fd, "nameKo") || nameEn;
  const slug = str(fd, "slug") || slugifyName(nameEn);
  if (!nameEn || slug === "unknown" || !/^[a-z0-9-]+$/.test(slug)) {
    back("/admin/taxonomy", { error: "영문명(또는 영문 slug)이 필요합니다." });
  }
  const data = { slug, nameEn, nameKo, descriptionKo: orNull(str(fd, "descriptionKo")) };
  try {
    if (kind === "manufacturer") await db().manufacturer.create({ data });
    else await db().category.create({ data });
  } catch (err) {
    if (isUniqueViolation(err)) back("/admin/taxonomy", { error: `이미 있는 slug입니다: ${slug}` });
    throw err;
  }
  revalidatePath("/admin/taxonomy");
  back("/admin/taxonomy", { message: `${nameEn} 추가됨 (${slug})` });
}

// ── CSV 가져오기 ──

export interface ImportState {
  stage: "idle" | "preview" | "done";
  csv?: string;
  plan?: {
    create: { line: number; mpn: string; manufacturerSlug: string; categorySlug: string | null; lifecycleStatus: string }[];
    skipped: ImportPlan["skipped"];
    errors: ImportPlan["errors"];
    newManufacturers: [string, string][];
  };
  result?: { created: number; failed: { line: number; message: string }[] };
}

export async function importAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("file");
  const csv = file instanceof File && file.size > 0 ? await file.text() : str(fd, "csv");
  const plan = planImport(csv, await loadImportIndex());

  if (fd.get("mode") === "execute" && plan.errors.length === 0) {
    const result = await executeImport(plan);
    revalidatePath("/admin/parts");
    return { stage: "done", result };
  }
  return {
    stage: "preview",
    csv,
    plan: {
      create: plan.create.map((r) => ({
        line: r.line,
        mpn: r.mpn,
        manufacturerSlug: r.manufacturerSlug,
        categorySlug: r.categorySlug,
        lifecycleStatus: r.lifecycleStatus,
      })),
      skipped: plan.skipped,
      errors: plan.errors,
      newManufacturers: [...plan.newManufacturers],
    },
  };
}
