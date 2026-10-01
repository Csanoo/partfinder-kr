/**
 * 유통사 Provider 공통 타입.
 *
 * 모든 가격·재고 데이터는 어느 유통사에서 언제 조회했는지(출처)를 함께 가진다.
 * 서로 다른 Provider의 데이터는 합치지 않고 Provider 단위로 따로 다룬다.
 */

export type ProviderId = string;

/**
 * 소스 분류. 정식 유통사(A 영역) 결과에는 authorized만 표시하고 broker는 섞지 않는다.
 * TODO(확인필요): 소스별 분류 기준 (예: LCSC는 브랜드별로 정식 여부가 다름)
 */
export type SourceKind = "authorized" | "broker";

/** 수량 구간별 단가. minQty 이상 주문 시 unitPrice 적용. */
export interface PriceBreak {
  minQty: number;
  unitPrice: number;
}

/** 부품 수명주기 상태. 유통사 표기를 이 값으로 매핑한다. */
export type LifecycleStatus = "active" | "nrnd" | "eol" | "obsolete" | "unknown";

/** Provider가 돌려주는 상품 한 건. 출처 필드(providerId/Name, productUrl, fetchedAt)는 필수. */
export interface Offer {
  providerId: ProviderId;
  providerName: string;
  manufacturer: string;
  mpn: string;
  description: string;
  /** 재고 수량. 유통사가 재고를 주지 않으면 null. */
  stock: number | null;
  priceBreaks: PriceBreak[];
  moq: number | null;
  /** ISO 4217 통화 코드 (USD, KRW 등). 환율 변환하지 않는다. */
  currency: string;
  /** 해당 유통사의 상품 페이지 URL. */
  productUrl: string;
  lifecycle: LifecycleStatus;
  /** 조회 시각 (ISO 8601). 캐시에서 꺼낸 경우에도 원래 조회 시각을 유지한다. */
  fetchedAt: string;
}

export interface SearchQuery {
  /** 사용자가 입력한 원본 검색어. */
  raw: string;
  /** 비교용 정규화 값 (대문자, 공백 제거). */
  normalized: string;
}

export type ProviderErrorReason =
  /** 분당 호출 한도 도달 */
  | "rate_limited"
  /** 일일 쿼터 소진 */
  | "quota_exceeded"
  /** 타임아웃 */
  | "timeout"
  /** 차단·CAPTCHA 응답 감지 (우회하지 않고 쿨다운) */
  | "blocked"
  /** robots.txt 등으로 수집이 허용되지 않음 */
  | "disallowed"
  /** 그 외 오류 (네트워크, 응답 형식 등) */
  | "error";

interface ProviderResultBase {
  providerId: ProviderId;
  providerName: string;
  kind: SourceKind;
  fetchedAt: string;
}

/** Provider 하나의 검색 결과. 결과 없음과 조회 실패를 구분한다. */
export type ProviderResult =
  | (ProviderResultBase & { status: "ok"; offers: Offer[] })
  | (ProviderResultBase & { status: "no_results" })
  | (ProviderResultBase & { status: "unavailable"; reason: ProviderErrorReason });

/** 소스별 호출 제한. 값이 없는 항목은 제한하지 않는다. */
export interface RateLimitPolicy {
  /** 연속 요청 사이 최소 간격(ms) */
  minIntervalMs?: number;
  /** 1분당 최대 요청 수 */
  perMinute?: number;
  /** 하루 최대 요청 수 */
  perDay?: number;
  /** 차단 감지 후 쿨다운(ms) */
  blockCooldownMs?: number;
}

/** 조회 실패를 Provider가 명시적으로 알릴 때 던지는 에러. */
export class ProviderError extends Error {
  constructor(
    public readonly reason: ProviderErrorReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "ProviderError";
  }
}

/**
 * 소스 어댑터 인터페이스.
 * 수집 방법(API, 공개 웹페이지 등)은 제한하지 않되 docs/SPEC.md 3장의 수집 가드레일을 지킨다.
 */
export interface PartProvider {
  readonly id: ProviderId;
  /** 화면에 표시할 소스명. 제휴·보증으로 보이는 문구는 넣지 않는다. */
  readonly displayName: string;
  readonly kind: SourceKind;
  readonly rateLimit?: RateLimitPolicy;
  /**
   * 품번으로 검색한다. 결과가 없으면 빈 배열을 돌려준다.
   * 조회 실패는 ProviderError(또는 일반 Error)를 던진다.
   */
  search(query: SearchQuery): Promise<Omit<Offer, "fetchedAt">[]>;
}
