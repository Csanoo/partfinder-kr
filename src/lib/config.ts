/**
 * 환경변수 기반 설정. 테스트에서 값을 바꿀 수 있도록 호출 시점에 읽는다.
 * 실제 API 키는 저장소에 넣지 않는다 (.env, 예시는 .env.example).
 */

function flag(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Provider feature flag. 모든 Provider의 기본값은 비활성(off). */
export const providerFlags = {
  mock: () => flag("PROVIDER_MOCK_ENABLED"),
  mouser: () => flag("PROVIDER_MOUSER_ENABLED"),
  // DigiKey: 외부 사이트 표시 사전 승인 회신 전까지 프로덕션에서 켜지 않는다.
  digikey: () => flag("PROVIDER_DIGIKEY_ENABLED"),
  // 공개 웹페이지 수집 소스 (broker). TODO(확인필요): 소스별 이용약관 검토 전까지 프로덕션에서 off
  heisener: () => flag("PROVIDER_HEISENER_ENABLED"),
  censtry: () => flag("PROVIDER_CENSTRY_ENABLED"),
  worldway: () => flag("PROVIDER_WORLDWAY_ENABLED"),
  // 공개 품번 페이지(/p/d/{MPN}.htm)만. 회원 영역·robots 금지 경로 제외
  hkinventory: () => flag("PROVIDER_HKINVENTORY_ENABLED"),
};

/**
 * 검색 응답 캐시 TTL(초). 기본 15분. 짧은 TTL만 허용하며 장기 보관용 부품 DB는 만들지 않는다.
 * TODO(확인필요): 유통사 약관상 캐시 허용 범위 회신 대기
 */
export function searchCacheTtlSeconds(): number {
  return positiveInt("SEARCH_CACHE_TTL_SECONDS", 15 * 60);
}

/** Provider 한 곳의 조회 제한 시간(ms). */
export function providerTimeoutMs(): number {
  return positiveInt("PROVIDER_TIMEOUT_MS", 8000);
}
