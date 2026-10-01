import { db } from "@/lib/db";
import { mergeSpecs, type ProposalField } from "@/lib/manufacturer/proposals";
import { sourceForManufacturer } from "@/lib/manufacturer/registry";
import type { ManufacturerFacts } from "@/lib/manufacturer/types";
import { updatePart } from "@/lib/parts/admin";
import { parseDateOnly, parseLifecycle, validateDatasheetUrl } from "@/lib/parts/validate-part";

/**
 * 제조사 정보 중 선택한 항목만 부품에 반영 (편집 화면 단건·일괄 반영 공통).
 * facts 는 다시 검증한다: 출처·데이터시트는 제조사 공식 https, 수명주기는 정해진 값만.
 */
export async function applyFacts(partId: string, facts: ManufacturerFacts, fields: Set<ProposalField>): Promise<{ applied: number }> {
  const part = await db().part.findUniqueOrThrow({
    where: { id: partId },
    select: {
      lifecycleStatus: true,
      lifecycleCheckedAt: true,
      lifecycleSource: true,
      package: true,
      datasheetUrl: true,
      keySpecs: true,
      categoryId: true,
      summaryKo: true,
      eolDate: true,
      manufacturer: { select: { slug: true } },
    },
  });
  const source = validateDatasheetUrl(facts.sourceUrl ?? "");
  if (!source.ok || !source.url || !sourceForManufacturer(part.manufacturer.slug)) {
    throw new Error("출처가 제조사 공식 URL이 아닙니다.");
  }
  const keySpecs = Array.isArray(part.keySpecs) ? (part.keySpecs as { label: string; value: string }[]) : [];
  const lifecycle = parseLifecycle(facts.lifecycle ?? "");
  const datasheet = validateDatasheetUrl(facts.datasheetUrl ?? "");
  const checkedAt = parseDateOnly((facts.fetchedAt ?? "").slice(0, 10));

  let applied = 0;
  const useLifecycle = fields.has("lifecycle") && lifecycle != null && lifecycle !== "unknown" && checkedAt.ok && checkedAt.date != null;
  const usePackage = fields.has("package") && !!facts.package;
  const useDatasheet = fields.has("datasheetUrl") && datasheet.ok && !!datasheet.url;
  const useSpecs = fields.has("specs") && Array.isArray(facts.specs);
  applied = [useLifecycle, usePackage, useDatasheet, useSpecs].filter(Boolean).length;
  if (applied === 0) return { applied };

  await updatePart(partId, {
    categoryId: part.categoryId,
    summaryKo: part.summaryKo,
    eolDate: part.eolDate,
    package: usePackage ? facts.package!.slice(0, 40) : part.package,
    datasheetUrl: useDatasheet && datasheet.ok ? datasheet.url : part.datasheetUrl,
    keySpecs: useSpecs ? mergeSpecs(keySpecs, facts.specs.slice(0, 20)) : keySpecs,
    lifecycleStatus: useLifecycle ? lifecycle! : part.lifecycleStatus,
    lifecycleCheckedAt: useLifecycle && checkedAt.ok ? checkedAt.date : part.lifecycleCheckedAt,
    lifecycleSource: useLifecycle ? source.url : part.lifecycleSource,
  });
  return { applied };
}
