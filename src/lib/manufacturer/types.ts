/**
 * 제조사 공식 정보 수집 공통 타입.
 * 사실 정보(상태·날짜·수치·URL)만 가져오고 설명 문장은 가져오지 않는다 (SEO_SPEC 제약 5).
 * 가져온 값은 바로 저장하지 않고 관리자가 승인한 항목만 부품에 반영한다.
 */

export type FactLifecycle = "active" | "nrnd" | "ltb" | "eol" | "unknown";

export interface ManufacturerFacts {
  /** 제조사 페이지 기준 주문 품번 */
  mpn: string;
  /** 정보를 확인한 제조사 공식 페이지 */
  sourceUrl: string;
  fetchedAt: string;
  lifecycle: FactLifecycle;
  /** 제조사 원문 표기 (예: ACTIVE, NRND, LIFEBUY) */
  lifecycleRaw: string | null;
  /** 정규화한 패키지 표기 (예: SOIC-8) */
  package: string | null;
  /** 제조사 패키지 표기 원문 (예: SOIC (D) | 8) */
  packageRaw: string | null;
  datasheetUrl: string | null;
  /** 수치·범위 등 사실 항목만 */
  specs: { label: string; value: string }[];
}

export type FetchFactsResult =
  | { status: "ok"; facts: ManufacturerFacts }
  | { status: "not_found"; tried: string[] }
  | { status: "unavailable"; reason: string };

export interface ManufacturerSource {
  id: string;
  /** 이 수집기가 담당하는 제조사 slug */
  manufacturerSlugs: string[];
  fetchFacts(mpn: string): Promise<FetchFactsResult>;
}
