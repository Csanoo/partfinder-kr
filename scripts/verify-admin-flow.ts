/**
 * 관리자 흐름 점검 (개발 DB). `TEST-E2E-` 로 시작하는 품번만 만들고, cleanup 인자로 지운다.
 * 실행: npx tsx scripts/verify-admin-flow.ts [cleanup]
 */
process.loadEnvFile(".env");

import { db } from "@/lib/db";
import {
  addAlternative,
  addFaq,
  bulkPublish,
  executeImport,
  getQuality,
  loadImportIndex,
  markReviewed,
  setAlternativeVerified,
  setFaqPublished,
  setPageStatus,
  updatePart,
} from "@/lib/parts/admin";
import { planImport } from "@/lib/parts/import-plan";

async function cleanup() {
  const r = await db().part.deleteMany({ where: { mpnDisplay: { startsWith: "TEST-E2E-" } } });
  console.log(`cleanup: ${r.count} parts deleted`);
}

async function main() {
  if (process.argv[2] === "cleanup") return cleanup();
  await cleanup();

  const today = new Date().toISOString().slice(0, 10);
  const csv = [
    "품번,제조사,카테고리,패키지,수명주기,단종일,확인일,출처",
    `TEST-E2E-OPA1,Texas Instruments,증폭기,SOIC-8,eol,2027-03-31,${today},E2E 점검`,
    `TEST-E2E-OPA1,Texas Instruments,증폭기,SOIC-8,eol,,${today},파일 안 중복`,
    "TEST-E2E-BAD,삼성전기,,,,,,",
  ].join("\n");

  const plan = planImport(csv, await loadImportIndex());
  console.log("plan:", { create: plan.create.length, skipped: plan.skipped.map((s) => s.reason), errors: plan.errors.map((e) => e.line) });
  const okPlan = { ...plan, errors: [] };
  const imported = await executeImport(okPlan);
  console.log("import:", imported);

  const part = await db().part.findFirstOrThrow({ where: { mpnDisplay: "TEST-E2E-OPA1" }, select: { id: true, pageStatus: true } });
  console.log("created status:", part.pageStatus);

  let q = await getQuality(part.id);
  console.log("after import, failing:", q.checks.filter((c) => !c.ok).map((c) => c.id));

  await updatePart(part.id, {
    categoryId: null,
    package: "SOIC-8",
    summaryKo:
      "TEST-E2E-OPA1은 점검용 가상 연산 증폭기입니다. 2026년 10월 기준 단종(EOL) 상태로 등록되어 있으며, 마지막 주문일은 2027년 3월 31일입니다. 핀 호환 대체품 1종이 확인되어 있습니다.",
    keySpecs: [
      { label: "채널 수", value: "2" },
      { label: "공급 전압", value: "3~32 V" },
      { label: "대역폭", value: "1 MHz" },
    ],
    lifecycleStatus: "eol",
    lifecycleCheckedAt: new Date(),
    lifecycleSource: "E2E 점검",
    eolDate: new Date("2027-03-31"),
    datasheetUrl: null,
  });
  await setPageStatus(part.id, "published");
  q = await getQuality(part.id);
  console.log("published but not reviewed, failing:", q.checks.filter((c) => !c.ok).map((c) => c.id));

  await markReviewed(part.id, "e2e");
  q = await getQuality(part.id);
  const stored = await db().part.findUniqueOrThrow({ where: { id: part.id }, select: { indexable: true } });
  console.log("reviewed → indexable:", q.indexable, "/ stored:", stored.indexable);

  await addFaq(part.id, { questionKo: "점검 질문?", answerKo: "점검 답변." });
  const faq = await db().partFaq.findFirstOrThrow({ where: { partId: part.id } });
  await setFaqPublished(faq.id, true);
  await addAlternative(part.id, { altMpn: "LM358-N/NOPB", relation: "drop_in", noteKo: "점검" });
  const alt = await db().partAlternative.findFirstOrThrow({ where: { partId: part.id }, select: { id: true, altPartId: true } });
  await setAlternativeVerified(alt.id, true, "e2e");
  q = await getQuality(part.id);
  console.log("signals:", q.signals, "/ alt linked to internal page:", alt.altPartId != null);

  try {
    await bulkPublish(Array.from({ length: 51 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`));
    console.log("bulk 51: NOT BLOCKED (unexpected)");
  } catch (e) {
    console.log("bulk 51 blocked:", (e as Error).message);
  }

  const slug = await db().partSlug.findFirstOrThrow({ where: { partId: part.id, isCanonical: true }, select: { slug: true } });
  console.log(`PART_ID=${part.id}`);
  console.log(`PUBLIC=/parts/texas-instruments/${slug.slug}`);
}

main()
  .then(() => db().$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db().$disconnect();
    process.exit(1);
  });
