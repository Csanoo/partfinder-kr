"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { applyFacts } from "@/lib/manufacturer/apply";
import { runFactsBatch } from "@/lib/manufacturer/batch";
import { buildProposals, type ProposalField } from "@/lib/manufacturer/proposals";
import type { ManufacturerFacts } from "@/lib/manufacturer/types";

/** 관리자 화면에서 한 번에 조회하는 개수 (요청 간격 때문에 1건당 수 초) */
export const ADMIN_BATCH_SIZE = 10;

const back = (params: Record<string, string>): never => redirect(`/admin/facts?${new URLSearchParams(params).toString()}`);

export async function runBatchAction() {
  await requireAdmin();
  const r = await runFactsBatch({ limit: ADMIN_BATCH_SIZE });
  revalidatePath("/admin/facts");
  back({
    message: `조회 ${r.processed}건: 대기 ${r.ok} · 못 찾음 ${r.notFound} · 실패 ${r.failed}${r.stoppedReason ? ` (중단: ${r.stoppedReason})` : ""}`,
  });
}

/** 선택한 결과의 '바뀐 항목'을 모두 반영 */
export async function applySelectedAction(fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll("ids").filter((v): v is string => typeof v === "string");
  let parts = 0;
  let fields = 0;
  for (const id of ids) {
    const fact = await db().manufacturerFact.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        facts: true,
        part: { select: { id: true, lifecycleStatus: true, lifecycleCheckedAt: true, package: true, datasheetUrl: true, keySpecs: true } },
      },
    });
    if (!fact || fact.status !== "pending" || !fact.facts) continue;
    const facts = fact.facts as unknown as ManufacturerFacts;
    const keySpecs = Array.isArray(fact.part.keySpecs) ? (fact.part.keySpecs as { label: string; value: string }[]) : [];
    const changed = new Set<ProposalField>(
      buildProposals({ ...fact.part, keySpecs }, facts)
        .filter((p) => p.changed)
        .map((p) => p.field),
    );
    const { applied } = await applyFacts(fact.part.id, facts, changed);
    await db().manufacturerFact.update({ where: { id }, data: { status: "applied" } });
    parts++;
    fields += applied;
  }
  revalidatePath("/admin/facts");
  back({ message: `${parts}개 부품에 ${fields}개 항목을 반영했습니다.` });
}

export async function dismissSelectedAction(fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll("ids").filter((v): v is string => typeof v === "string");
  const r = await db().manufacturerFact.updateMany({ where: { id: { in: ids }, status: "pending" }, data: { status: "dismissed" } });
  revalidatePath("/admin/facts");
  back({ message: `${r.count}건을 무시했습니다.` });
}
