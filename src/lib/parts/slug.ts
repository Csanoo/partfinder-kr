/**
 * 부품 URL 규칙 (docs/SEO_SPEC.md 3·4장)
 *
 * - mpnKey: 동일 부품 판정용. 대문자, 공백·하이픈 제거. 그 외 문자(/, #, + 등)는 유지.
 * - mpnSlug: URL 경로용. 소문자 + URL 안전 문자만. 사람이 읽기 쉬운 치환을 쓰고, 되돌릴 필요는 없다
 *   (slug ↔ 부품 매핑은 DB(part_slug)에 저장해서 찾는다).
 * - slugKey: 들어온 URL 매칭용. slug에서 대소문자·하이픈 차이를 없앤 값.
 *   같은 제조사 안에서 slugKey가 같으면 같은 URL로 본다 (정규 URL로 301).
 */

/** 원본 품번 → 동일 부품 판정 키 */
export function mpnKey(mpnDisplay: string): string {
  return mpnDisplay.normalize("NFKC").replace(/[\s\-‐-―−]+/g, "").toUpperCase();
}

const MAX_SLUG_LENGTH = 80;

/** 특수문자 치환 규칙. 순서대로 적용한다. */
const REPLACEMENTS: [RegExp, string][] = [
  [/[µμ]/g, "u"], // μPC1237 → upc1237 (업계 관용 표기)
  [/\+/g, "-plus"], // MAX232CPE+ → max232cpe-plus (납 없는 표기 등, 의미 보존)
  [/&/g, "-and-"],
  [/[/#,;:()[\]{}|\\*'"!?@$%^=<>`~]/g, "_"], // 구분 문자류 → _
  [/\s+/g, "-"],
];

/** 원본 품번 → URL slug (충돌은 allocateSlug에서 처리) */
export function slugifyMpn(mpnDisplay: string): string {
  let s = mpnDisplay.normalize("NFKC").trim().toLowerCase();
  // 유니코드 대시류는 일반 하이픈으로
  s = s.replace(/[‐-―−]/g, "-");
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  // 남은 비허용 문자 (a-z, 0-9, ., _, - 외) → _
  s = s.replace(/[^a-z0-9._-]/g, "_");
  // 연속 구분자 정리, 앞뒤 구분자 제거
  s = s.replace(/_+/g, "_").replace(/-+/g, "-").replace(/[-_]*_[-_]*/g, "_");
  s = s.replace(/^[-_.]+|[-_.]+$/g, "");
  if (s.length > MAX_SLUG_LENGTH) s = s.slice(0, MAX_SLUG_LENGTH).replace(/[-_.]+$/, "");
  return s === "" ? "part" : s;
}

/** URL로 들어온 slug(또는 정규 slug) → 매칭 키. 대소문자·하이픈 차이를 무시한다. */
export function slugKey(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // 잘못된 인코딩은 그대로 사용
  }
  return s.normalize("NFKC").toLowerCase().replace(/[-‐-―−\s]+/g, "");
}

/**
 * 같은 제조사 안에서 쓸 수 있는 slug를 정한다.
 * 기본 slug의 slugKey가 다른 부품에 이미 쓰이고 있으면 `_2`, `_3` … 을 붙인다.
 * @param taken 같은 제조사에서 이미 쓰이는 slugKey 집합 (자기 자신의 기존 slug는 제외해서 넘긴다)
 */
export function allocateSlug(mpnDisplay: string, taken: ReadonlySet<string>): string {
  const base = slugifyMpn(mpnDisplay);
  if (!taken.has(slugKey(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(slugKey(candidate))) return candidate;
  }
  throw new Error(`slug allocation failed for ${mpnDisplay}`);
}

/** 제조사·카테고리 slug: 소문자, 영숫자와 하이픈만. */
export function slugifyName(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s === "" ? "unknown" : s.slice(0, 60).replace(/-+$/, "");
}
