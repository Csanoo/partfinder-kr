import { slugKey } from "@/lib/parts/slug";

export type PageStatus = "draft" | "review" | "published" | "unpublished";

export interface PartRouteHit {
  partId: string;
  pageStatus: PageStatus;
  /** 현재 정규 slug */
  canonicalSlug: string;
}

export interface PartRouteRepo {
  findManufacturerBySlug(slug: string): Promise<{ id: string; slug: string } | null>;
  /** part_slug(현재·과거 slug)에서 slugKey로 찾는다 */
  findPartBySlugKey(manufacturerId: string, key: string): Promise<PartRouteHit | null>;
  /** part_variant(변형 품번)에서 slugKey로 찾는다 */
  findPartByVariantSlugKey(manufacturerId: string, key: string): Promise<PartRouteHit | null>;
}

export type PartRouteResult =
  | { kind: "ok"; partId: string }
  /** 정규 URL이 아님 (대소문자·하이픈 차이, 과거 slug, 변형 품번, 제조사 slug 대소문자) → 301 */
  | { kind: "redirect"; location: string }
  /** 비게시 전환 → 410 */
  | { kind: "gone" }
  /** 없음 또는 아직 게시 전(draft/review) → 404 */
  | { kind: "not_found" };

export function partPath(manufacturerSlug: string, mpnSlug: string): string {
  return `/parts/${manufacturerSlug}/${mpnSlug}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** `/parts/{manufacturer}/{mpn}` 요청을 해석한다 (docs/SEO_SPEC.md 4장). */
export async function resolvePartRoute(
  manufacturerRaw: string,
  mpnRaw: string,
  repo: PartRouteRepo,
): Promise<PartRouteResult> {
  const mfrDecoded = safeDecode(manufacturerRaw);
  const mfr = await repo.findManufacturerBySlug(mfrDecoded.toLowerCase());
  if (mfr == null) return { kind: "not_found" };

  const key = slugKey(mpnRaw);
  if (key === "") return { kind: "not_found" };

  let hit = await repo.findPartBySlugKey(mfr.id, key);
  let viaVariant = false;
  if (hit == null) {
    hit = await repo.findPartByVariantSlugKey(mfr.id, key);
    viaVariant = hit != null;
  }
  if (hit == null) return { kind: "not_found" };

  if (hit.pageStatus === "unpublished") return { kind: "gone" };
  if (hit.pageStatus !== "published") return { kind: "not_found" };

  const isCanonical = !viaVariant && mfrDecoded === mfr.slug && safeDecode(mpnRaw) === hit.canonicalSlug;
  if (!isCanonical) return { kind: "redirect", location: partPath(mfr.slug, hit.canonicalSlug) };
  return { kind: "ok", partId: hit.partId };
}
