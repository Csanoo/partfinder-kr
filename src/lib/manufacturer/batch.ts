import type { Prisma } from "@/generated/prisma/client";
import type { PageStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { fetchManufacturerFacts, supportedManufacturerSlugs } from "@/lib/manufacturer/registry";
import { TI_MIN_INTERVAL_MS } from "@/lib/manufacturer/ti";

/** 관리자 화면에서 한 번에 조회하는 개수 (요청 간격 때문에 1건당 수 초) */
export const ADMIN_BATCH_SIZE = 10;

export interface BatchOptions {
  limit: number;
  /** 대상 게시 상태 (기본: 초안·검토 중) */
  pageStatuses?: PageStatus[];
  /** 이 기간이 지난 조회 결과는 다시 조회 (반영·무시된 건 포함). 대기 중(pending)인 건은 다시 조회하지 않음 */
  refetchAfterDays?: number;
  log?: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface BatchResult {
  processed: number;
  ok: number;
  notFound: number;
  failed: number;
  /** 차단·일일 한도 등으로 중간에 멈춘 이유 */
  stoppedReason?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 대상: 지원 제조사의 부품 중 조회 결과가 없거나 오래된 것 (초안 우선, 오래된 순) */
export async function pickTargets(limit: number, pageStatuses: PageStatus[], refetchAfterDays: number) {
  const staleBefore = new Date(Date.now() - refetchAfterDays * 86_400_000);
  const where: Prisma.PartWhereInput = {
    pageStatus: { in: pageStatuses },
    manufacturer: { slug: { in: supportedManufacturerSlugs() } },
    OR: [{ manufacturerFact: null }, { manufacturerFact: { status: { not: "pending" }, fetchedAt: { lt: staleBefore } } }],
  };
  return db().part.findMany({
    where,
    orderBy: [{ pageStatus: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, mpnDisplay: true, manufacturer: { select: { slug: true } } },
  });
}

/**
 * 제조사 공식 정보 일괄 조회 → manufacturer_fact 에 저장 (부품에는 반영하지 않음, 관리자 검토 후 반영).
 * 요청 간격을 지키고, 차단·한도에 걸리면 즉시 멈춘다 (우회하지 않음).
 */
export async function runFactsBatch(opts: BatchOptions): Promise<BatchResult> {
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? defaultSleep;
  const targets = await pickTargets(opts.limit, opts.pageStatuses ?? ["draft", "review"], opts.refetchAfterDays ?? 30);
  const result: BatchResult = { processed: 0, ok: 0, notFound: 0, failed: 0 };

  for (const [i, part] of targets.entries()) {
    if (i > 0) await sleep(TI_MIN_INTERVAL_MS);
    let r = await fetchManufacturerFacts(part.manufacturer.slug, part.mpnDisplay);
    // 분당 상한: 1분 기다렸다 한 번만 다시
    if (r.status === "unavailable" && r.reason === "rate_limited") {
      log("분당 한도 도달, 60초 대기");
      await sleep(60_000);
      r = await fetchManufacturerFacts(part.manufacturer.slug, part.mpnDisplay);
    }
    if (r.status === "unavailable" && ["blocked", "quota_exceeded", "disallowed", "rate_limited"].includes(r.reason)) {
      result.stoppedReason = r.reason;
      log(`중단: ${r.reason}`);
      break;
    }

    const now = new Date();
    const data =
      r.status === "ok"
        ? { status: "pending" as const, facts: r.facts as unknown as Prisma.InputJsonValue, message: null }
        : r.status === "not_found"
          ? { status: "not_found" as const, facts: undefined, message: `후보 ${r.tried.length}개 URL에서 찾지 못함` }
          : { status: "failed" as const, facts: undefined, message: r.reason };
    await db().manufacturerFact.upsert({
      where: { partId: part.id },
      create: { partId: part.id, sourceId: part.manufacturer.slug, fetchedAt: now, ...data },
      update: { fetchedAt: now, ...data },
    });

    result.processed++;
    if (r.status === "ok") result.ok++;
    else if (r.status === "not_found") result.notFound++;
    else result.failed++;
    log(`${part.mpnDisplay}: ${data.status}`);
  }
  return result;
}
