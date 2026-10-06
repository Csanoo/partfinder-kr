import { timingSafeEqual } from "node:crypto";
import { purgeExpiredPersonalData } from "@/lib/inquiry/retention";
import { runFactsBatch } from "@/lib/manufacturer/batch";
import { recordIndexSnapshot } from "@/lib/metrics";
import { recomputeAllIndexable } from "@/lib/parts/admin";
import { translationEnabled } from "@/lib/parts/translate-llm";
import { translateOutdatedParts } from "@/lib/parts/translations";

/**
 * 서버 cron 이 호출하는 정기 작업 (POST /api/cron/{job}, Authorization: Bearer CRON_SECRET).
 * 배포 서버의 웹서버(Caddy)는 /api/cron 을 외부에 열지 않는다 (deploy/Caddyfile).
 */
export const CRON_JOBS = {
  /** 매일: 색인 가능 여부 재계산(확인일 경과 반영) + 일별 기록 */
  "recompute-indexable": async () => {
    const parts = await recomputeAllIndexable();
    await recordIndexSnapshot();
    return { parts };
  },
  /** 매일: 개인정보 보유기간 경과분 파기 (PERSONAL_DATA_RETENTION_DAYS 없으면 아무것도 안 함) */
  "purge-personal-data": () => purgeExpiredPersonalData(),
  /** 매일 새벽: 제조사 공식 정보 조회 (초안·검토 중, 지원 제조사) */
  "manufacturer-facts": () => runFactsBatch({ limit: Number(process.env.CRON_FACTS_LIMIT ?? 100) }),
  /** 매일: 게시 부품 중 번역이 없거나 원문이 바뀐 것 번역 (TRANSLATION_ENABLED 일 때만) */
  "translate-parts": async () =>
    translationEnabled() ? translateOutdatedParts(Number(process.env.CRON_TRANSLATE_LIMIT ?? 20)) : { skipped: "TRANSLATION_ENABLED 미설정" },
} as const;

export type CronJob = keyof typeof CRON_JOBS;

export function isCronJob(name: string): name is CronJob {
  return Object.hasOwn(CRON_JOBS, name);
}

/** CRON_SECRET 이 없으면 항상 거부 */
export function verifyCronSecret(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !authorization?.startsWith("Bearer ")) return false;
  const a = Buffer.from(authorization.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
