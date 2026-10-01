import { ProviderError, type Offer, type PartProvider, type ProviderId } from "@/lib/providers/types";

/**
 * 아직 구현되지 않은 실제 유통사 Provider 자리표시.
 * 플래그가 잘못 켜져도 외부 호출 없이 "일시 조회 불가"로 표시된다.
 * - Mouser: 10장 6단계에서 공식 Search API로 구현 (rate limiter·일일 쿼터 포함)
 * - DigiKey: 10장 7단계에서 공식 API로 구현 (외부 표시 승인 회신 전까지 플래그 off)
 */
export class NotImplementedProvider implements PartProvider {
  constructor(
    readonly id: ProviderId,
    readonly displayName: string,
  ) {}

  async search(): Promise<Omit<Offer, "fetchedAt">[]> {
    throw new ProviderError("error", `${this.id} provider is not implemented yet`);
  }
}
