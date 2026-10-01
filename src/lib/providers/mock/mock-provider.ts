import { normalizeMpn } from "@/lib/search/normalize";
import {
  ProviderError,
  type Offer,
  type PartProvider,
  type ProviderErrorReason,
  type ProviderId,
  type SearchQuery,
} from "@/lib/providers/types";

type FixtureOffer = Omit<Offer, "providerId" | "providerName" | "fetchedAt">;

/** fixture: 정규화 품번 → 상품 목록, 또는 조회 실패 시뮬레이션. */
export type MockFixture = Record<string, FixtureOffer[] | { error: ProviderErrorReason }>;

/** 개발·테스트용 Provider. 외부 호출 없이 fixture JSON만 사용한다. */
export class MockProvider implements PartProvider {
  private readonly fixture: Map<string, MockFixture[string]>;

  constructor(
    readonly id: ProviderId,
    readonly displayName: string,
    fixture: MockFixture,
  ) {
    this.fixture = new Map(Object.entries(fixture).map(([k, v]) => [normalizeMpn(k), v]));
  }

  async search(query: SearchQuery): Promise<Omit<Offer, "fetchedAt">[]> {
    const entry = this.fixture.get(query.normalized);
    if (entry == null) return [];
    if (!Array.isArray(entry)) throw new ProviderError(entry.error, `mock ${this.id}: ${entry.error}`);
    return entry.map((o) => ({ ...o, providerId: this.id, providerName: this.displayName }));
  }
}
