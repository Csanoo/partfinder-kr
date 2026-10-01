/**
 * 제조사 정보 일괄 조회 점검 (개발 DB + 실제 TI 사이트).
 * 실행: npx tsx scripts/verify-facts-batch.mts [cleanup]
 */
process.loadEnvFile(".env");

import { db } from "@/lib/db";
import { applyFacts } from "@/lib/manufacturer/apply";
import { runFactsBatch } from "@/lib/manufacturer/batch";
import { buildProposals, type ProposalField } from "@/lib/manufacturer/proposals";
import type { ManufacturerFacts } from "@/lib/manufacturer/types";
import { executeImport, loadImportIndex } from "@/lib/parts/admin";
import { planImport } from "@/lib/parts/import-plan";
import { mpnKey } from "@/lib/parts/slug";

const ADDED = ["TPS54331DR", "SN74HC595N", "LM2596S-ADJ/NOPB", "TINOPE999X"];

async function cleanup() {
  const r = await db().part.deleteMany({ where: { mpnKey: { in: ADDED.map(mpnKey) } } });
  await db().manufacturerFact.deleteMany({ where: { part: { mpnDisplay: "SN65HVD230DR" } } });
  console.log(`cleanup: ${r.count} parts deleted`);
}

if (process.argv[2] === "cleanup") {
  await cleanup();
} else {
  await cleanup();
  const csv = ["mpn,manufacturer", ...ADDED.map((m) => `${m},Texas Instruments`)].join("\n");
  console.log("import:", await executeImport(planImport(csv, await loadImportIndex())));

  const t0 = Date.now();
  const r = await runFactsBatch({ limit: 10, log: (m) => console.log("  ", m) });
  console.log("batch:", r, `${Math.round((Date.now() - t0) / 1000)}s`);

  const pending = await db().manufacturerFact.findMany({
    where: { status: "pending" },
    include: { part: { select: { id: true, mpnDisplay: true, lifecycleStatus: true, lifecycleCheckedAt: true, package: true, datasheetUrl: true, keySpecs: true } } },
  });
  for (const f of pending) {
    const facts = f.facts as unknown as ManufacturerFacts;
    const keySpecs = (f.part.keySpecs as { label: string; value: string }[]) ?? [];
    const changed = new Set<ProposalField>(buildProposals({ ...f.part, keySpecs }, facts).filter((p) => p.changed).map((p) => p.field));
    const { applied } = await applyFacts(f.part.id, facts, changed);
    await db().manufacturerFact.update({ where: { id: f.id }, data: { status: "applied" } });
    const after = await db().part.findUniqueOrThrow({
      where: { id: f.part.id },
      select: { lifecycleStatus: true, lifecycleCheckedAt: true, lifecycleSource: true, package: true, datasheetUrl: true },
    });
    console.log(`applied ${f.part.mpnDisplay}: ${applied} fields →`, {
      ...after,
      lifecycleCheckedAt: after.lifecycleCheckedAt?.toISOString().slice(0, 10),
    });
  }
}
await db().$disconnect();
