import { ProviderError, type Offer, type PartProvider, type ProviderId, type SourceKind } from "@/lib/providers/types";

/**
 * 아직 구현되지 않은 실제 소스 Provider 자리표시.
 * 플래그가 잘못 켜져도 외부 호출 없이 "일시 조회 불가"로 표시된다. 구현 계획은 docs/SPEC.md 10장.
 */
export class NotImplementedProvider implements PartProvider {
  constructor(
    readonly id: ProviderId,
    readonly displayName: string,
    readonly kind: SourceKind,
  ) {}

  async search(): Promise<Omit<Offer, "fetchedAt">[]> {
    throw new ProviderError("error", `${this.id} provider is not implemented yet`);
  }
}
