import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { tiSource } from "@/lib/manufacturer/ti";
import type { FetchFactsResult, ManufacturerSource } from "@/lib/manufacturer/types";

/**
 * 제조사 공식 정보 수집기 목록.
 * - TI: 공개 부품 상세 페이지 (robots.txt 허용, Crawl-delay 1초)
 * - ADI·ST·Microchip: 2026-10-01 확인 시 자동 접속 차단(시간 초과·403) → 우회하지 않고 공식 내보내기 파일 가져오기로 대체 예정
 */
const sources: ManufacturerSource[] = [tiSource()];

/** 관리자 조회 남용 방지: 수집기별 분당·일일 상한 */
const POLICY = { perMinute: 20, perDay: 500, blockCooldownMs: 60 * 60_000 };
const g = globalThis as unknown as { __mfrLimiter?: ProviderRateLimiter };
const limiter = (g.__mfrLimiter ??= new ProviderRateLimiter());

export function supportedManufacturerSlugs(): string[] {
  return sources.flatMap((s) => s.manufacturerSlugs);
}

export function sourceForManufacturer(manufacturerSlug: string): ManufacturerSource | null {
  return sources.find((s) => s.manufacturerSlugs.includes(manufacturerSlug)) ?? null;
}

export async function fetchManufacturerFacts(manufacturerSlug: string, mpn: string): Promise<FetchFactsResult> {
  const source = sourceForManufacturer(manufacturerSlug);
  if (!source) return { status: "unavailable", reason: "unsupported" };
  const ok = limiter.tryAcquire(`mfr:${source.id}`, POLICY);
  if (!ok.ok) return { status: "unavailable", reason: ok.reason };
  const result = await source.fetchFacts(mpn);
  if (result.status === "unavailable" && result.reason === "blocked") limiter.reportBlocked(`mfr:${source.id}`, POLICY);
  return result;
}
