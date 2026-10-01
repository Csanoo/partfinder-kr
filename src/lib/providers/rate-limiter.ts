import type { ProviderErrorReason, ProviderId, RateLimitPolicy } from "@/lib/providers/types";

interface State {
  lastAt: number | null;
  minuteHits: number[];
  dayKey: string;
  dayCount: number;
  cooldownUntil: number;
}

export type AcquireResult = { ok: true } | { ok: false; reason: ProviderErrorReason };

/**
 * 소스별 호출 제한 (최소 간격, 분당, 일일, 차단 쿨다운).
 * 한도에 걸리면 기다리지 않고 거절하며, 해당 소스만 "일시 조회 불가"가 된다.
 *
 * 인메모리라 서버 재시작 시 일일 카운터가 초기화되고 다중 인스턴스 간 공유되지 않는다.
 * TODO(확인필요): 배포 환경 확정 후 일일 카운터를 DB(또는 Redis)로 옮길지 결정
 */
export class ProviderRateLimiter {
  private readonly states = new Map<ProviderId, State>();

  constructor(private readonly now: () => number = Date.now) {}

  tryAcquire(id: ProviderId, policy: RateLimitPolicy | undefined): AcquireResult {
    if (policy == null) return { ok: true };
    const t = this.now();
    const s = this.state(id, t);

    if (t < s.cooldownUntil) return { ok: false, reason: "blocked" };
    if (policy.perDay != null && s.dayCount >= policy.perDay) return { ok: false, reason: "quota_exceeded" };

    s.minuteHits = s.minuteHits.filter((h) => h > t - 60_000);
    if (policy.perMinute != null && s.minuteHits.length >= policy.perMinute) {
      return { ok: false, reason: "rate_limited" };
    }
    if (policy.minIntervalMs != null && s.lastAt != null && t - s.lastAt < policy.minIntervalMs) {
      return { ok: false, reason: "rate_limited" };
    }

    s.lastAt = t;
    s.minuteHits.push(t);
    s.dayCount += 1;
    return { ok: true };
  }

  /** 차단·CAPTCHA 응답을 받았을 때 호출. 우회하지 않고 쿨다운 동안 요청을 멈춘다. */
  reportBlocked(id: ProviderId, policy: RateLimitPolicy | undefined): void {
    const t = this.now();
    this.state(id, t).cooldownUntil = t + (policy?.blockCooldownMs ?? 30 * 60_000);
  }

  private state(id: ProviderId, t: number): State {
    const dayKey = kstDayKey(t);
    let s = this.states.get(id);
    if (s == null) {
      s = { lastAt: null, minuteHits: [], dayKey, dayCount: 0, cooldownUntil: 0 };
      this.states.set(id, s);
    }
    if (s.dayKey !== dayKey) {
      s.dayKey = dayKey;
      s.dayCount = 0;
    }
    return s;
  }
}

/**
 * 일일 카운터 기준 날짜 (KST).
 * TODO(확인필요): 소스별 일일 한도의 리셋 기준 시각
 */
function kstDayKey(t: number): string {
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
}
