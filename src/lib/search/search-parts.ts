import { providerTimeoutMs, searchCacheTtlSeconds } from "@/lib/config";
import { getEnabledProviders } from "@/lib/providers/registry";
import {
  ProviderError,
  type PartProvider,
  type ProviderErrorReason,
  type ProviderResult,
  type SearchQuery,
} from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";

export interface SearchOptions {
  providers?: PartProvider[];
  cache?: TtlCache<ProviderResult>;
  now?: () => Date;
  timeoutMs?: number;
  cacheTtlSeconds?: number;
}

// 개발 서버 HMR에서도 캐시가 유지되도록 globalThis에 둔다.
const globalForCache = globalThis as unknown as { __searchCache?: TtlCache<ProviderResult> };
const defaultCache = (globalForCache.__searchCache ??= new TtlCache<ProviderResult>());

/**
 * 활성화된 모든 Provider를 병렬 조회한다.
 * 한 Provider가 실패해도 나머지 결과는 정상 반환되며, 결과는 Provider 단위로 분리된 채 돌려준다.
 */
export async function searchParts(query: SearchQuery, options: SearchOptions = {}): Promise<ProviderResult[]> {
  const providers = options.providers ?? getEnabledProviders();
  const cache = options.cache ?? defaultCache;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? providerTimeoutMs();
  const ttl = options.cacheTtlSeconds ?? searchCacheTtlSeconds();

  if (query.normalized === "") return [];

  return Promise.all(
    providers.map(async (provider): Promise<ProviderResult> => {
      const key = `${provider.id}:${query.normalized}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const result = await queryProvider(provider, query, now, timeoutMs);
      // 실패 결과는 캐시하지 않는다.
      if (result.status !== "unavailable") cache.set(key, result, ttl);
      return result;
    }),
  );
}

async function queryProvider(
  provider: PartProvider,
  query: SearchQuery,
  now: () => Date,
  timeoutMs: number,
): Promise<ProviderResult> {
  const base = { providerId: provider.id, providerName: provider.displayName };
  try {
    const offers = await withTimeout(provider.search(query), timeoutMs);
    const fetchedAt = now().toISOString();
    if (offers.length === 0) return { status: "no_results", ...base, fetchedAt };
    return {
      status: "ok",
      ...base,
      fetchedAt,
      offers: offers.map((o) => ({ ...o, ...base, fetchedAt })),
    };
  } catch (err) {
    const reason: ProviderErrorReason = err instanceof ProviderError ? err.reason : "error";
    console.error(`[search] provider ${provider.id} failed (${reason}):`, err);
    return { status: "unavailable", ...base, reason, fetchedAt: now().toISOString() };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderError("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
