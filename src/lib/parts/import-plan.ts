import { parseCsv } from "@/lib/parts/csv";
import { mpnKey, slugifyName } from "@/lib/parts/slug";
import { parseDateOnly, parseLifecycle, validateDatasheetUrl, type Lifecycle } from "@/lib/parts/validate-part";

/** CSV 가져오기 1회 최대 행 수. TODO(확인필요): 상한 값 */
export const MAX_IMPORT_ROWS = 1000;

/** 헤더 별칭 (영문·한글) → 표준 필드 */
const HEADER_ALIASES: Record<string, Field> = {
  mpn: "mpn",
  품번: "mpn",
  manufacturer: "manufacturer",
  제조사: "manufacturer",
  category: "category",
  카테고리: "category",
  package: "package",
  패키지: "package",
  lifecycle_status: "lifecycle_status",
  수명주기: "lifecycle_status",
  eol_date: "eol_date",
  단종일: "eol_date",
  lifecycle_checked_at: "lifecycle_checked_at",
  확인일: "lifecycle_checked_at",
  lifecycle_source: "lifecycle_source",
  출처: "lifecycle_source",
  datasheet_url: "datasheet_url",
  데이터시트: "datasheet_url",
};

type Field =
  | "mpn"
  | "manufacturer"
  | "category"
  | "package"
  | "lifecycle_status"
  | "eol_date"
  | "lifecycle_checked_at"
  | "lifecycle_source"
  | "datasheet_url";

export interface ImportRow {
  line: number;
  mpn: string;
  manufacturerName: string;
  manufacturerSlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  package: string | null;
  lifecycleStatus: Lifecycle;
  eolDate: Date | null;
  lifecycleCheckedAt: Date | null;
  lifecycleSource: string | null;
  datasheetUrl: string | null;
}

export interface ImportPlan {
  create: ImportRow[];
  skipped: { line: number; mpn: string; reason: string }[];
  errors: { line: number; message: string }[];
  /** DB에 없어서 새로 만들 제조사 (slug → 영문명) */
  newManufacturers: Map<string, string>;
}

export interface ExistingIndex {
  /** 제조사 조회: 소문자 slug·영문명·한글명 → slug */
  manufacturers: Map<string, string>;
  /** 카테고리 조회: 소문자 slug·영문명·한글명 → slug */
  categories: Map<string, string>;
  /** `${manufacturerSlug}|${mpnKey}` */
  partKeys: Set<string>;
}

/** 조회용 키: 앞뒤 공백 제거 + 소문자 */
export const lookupKey = (s: string) => s.trim().toLowerCase();

/**
 * CSV 텍스트를 검증하고 생성 계획을 만든다 (DB 쓰기 없음).
 * 가져온 부품은 모두 draft로 생성한다.
 */
export function planImport(csvText: string, existing: ExistingIndex): ImportPlan {
  const plan: ImportPlan = { create: [], skipped: [], errors: [], newManufacturers: new Map() };
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    plan.errors.push({ line: 0, message: "빈 파일입니다." });
    return plan;
  }

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? HEADER_ALIASES[h.trim()] ?? null);
  for (const required of ["mpn", "manufacturer"] as const) {
    if (!header.includes(required)) plan.errors.push({ line: 1, message: `필수 열이 없습니다: ${required}` });
  }
  if (plan.errors.length > 0) return plan;
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    plan.errors.push({ line: 0, message: `한 번에 ${MAX_IMPORT_ROWS}행까지 가져올 수 있습니다.` });
    return plan;
  }

  const seenInFile = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const get = (f: Field) => {
      const idx = header.indexOf(f);
      return idx < 0 ? "" : (rows[r][idx] ?? "").trim();
    };

    const mpn = get("mpn");
    const manufacturerName = get("manufacturer");
    const rowErrors: string[] = [];
    if (mpn === "") rowErrors.push("품번이 비어 있습니다.");
    if (manufacturerName === "") rowErrors.push("제조사가 비어 있습니다.");

    const lifecycle = parseLifecycle(get("lifecycle_status"));
    if (lifecycle == null) rowErrors.push(`수명주기 값이 올바르지 않습니다: ${get("lifecycle_status")}`);
    const eol = parseDateOnly(get("eol_date"));
    if (!eol.ok) rowErrors.push(`eol_date: ${eol.error}`);
    const checked = parseDateOnly(get("lifecycle_checked_at"));
    if (!checked.ok) rowErrors.push(`lifecycle_checked_at: ${checked.error}`);
    const datasheet = validateDatasheetUrl(get("datasheet_url"));
    if (!datasheet.ok) rowErrors.push(`datasheet_url: ${datasheet.error}`);

    // 제조사: 기존 항목(slug·영문명·한글명)과 맞추고, 없으면 영문명으로 새로 만든다
    let manufacturerSlug = existing.manufacturers.get(lookupKey(manufacturerName)) ?? null;
    if (manufacturerSlug == null && manufacturerName !== "") {
      const slug = slugifyName(manufacturerName);
      if (slug === "unknown") rowErrors.push(`새 제조사는 영문명으로 입력해 주세요 (또는 먼저 등록): ${manufacturerName}`);
      else manufacturerSlug = existing.manufacturers.get(slug) ?? slug;
    }
    // 카테고리: 미리 등록된 것만 (slug·영문명·한글명)
    const categoryName = get("category") || null;
    const categorySlug = categoryName ? (existing.categories.get(lookupKey(categoryName)) ?? null) : null;
    if (categoryName && categorySlug == null) rowErrors.push(`등록되지 않은 카테고리입니다: ${categoryName}`);

    if (rowErrors.length > 0 || manufacturerSlug == null) {
      plan.errors.push({ line, message: rowErrors.join(" ") });
      continue;
    }

    const key = `${manufacturerSlug}|${mpnKey(mpn)}`;
    if (existing.partKeys.has(key)) {
      plan.skipped.push({ line, mpn, reason: "이미 등록된 부품" });
      continue;
    }
    if (seenInFile.has(key)) {
      plan.skipped.push({ line, mpn, reason: "파일 안 중복" });
      continue;
    }
    seenInFile.add(key);

    if (![...existing.manufacturers.values()].includes(manufacturerSlug)) plan.newManufacturers.set(manufacturerSlug, manufacturerName);

    plan.create.push({
      line,
      mpn,
      manufacturerName,
      manufacturerSlug,
      categoryName,
      categorySlug,
      package: get("package") || null,
      lifecycleStatus: lifecycle!,
      eolDate: eol.ok ? eol.date : null,
      lifecycleCheckedAt: checked.ok ? checked.date : null,
      lifecycleSource: get("lifecycle_source") || null,
      datasheetUrl: datasheet.ok ? datasheet.url : null,
    });
  }
  return plan;
}
