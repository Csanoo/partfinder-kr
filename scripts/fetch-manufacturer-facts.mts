/**
 * 제조사 공식 정보 일괄 조회 (긴 작업용).
 * 결과는 manufacturer_fact 에 '검토 대기'로 쌓이고, /admin/facts 에서 검토 후 반영한다.
 *
 * 실행: npm run mfr:fetch -- --limit=100 [--status=draft,review,published] [--refetch-days=30]
 */
process.loadEnvFile(".env");

import type { PageStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { runFactsBatch } from "@/lib/manufacturer/batch";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const limit = Number(arg("limit") ?? 50);
const statuses = (arg("status") ?? "draft,review").split(",") as PageStatus[];
const refetchAfterDays = Number(arg("refetch-days") ?? 30);

const started = Date.now();
const result = await runFactsBatch({
  limit,
  pageStatuses: statuses,
  refetchAfterDays,
  log: (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`),
});
console.log({ ...result, seconds: Math.round((Date.now() - started) / 1000) });
await db().$disconnect();
