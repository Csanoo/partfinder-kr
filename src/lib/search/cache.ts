/**
 * 짧은 TTL 인메모리 응답 캐시. 장기 보관용 부품 DB가 아니다.
 * 트래픽이 생기면 Redis로 교체한다.
 */
export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (hit == null) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    this.sweep();
  }

  /** 만료 항목 정리. 캐시가 쌓이기만 하지 않도록 set 시점에 수행. */
  private sweep(): void {
    const t = this.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt <= t) this.store.delete(k);
    }
  }
}
