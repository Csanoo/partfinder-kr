/**
 * 사이트맵 점검용: 색인 기준을 충족하는 TEST-E2E-SM* 부품 5개 생성 / cleanup 으로 삭제.
 * 실행: npx tsx scripts/verify-sitemap.mts [cleanup]
 */
process.loadEnvFile(".env");

import { db } from "@/lib/db";
import { createDraftPart, markReviewed, setPageStatus, updatePart } from "@/lib/parts/admin";

async function cleanup() {
  const r = await db().part.deleteMany({ where: { mpnDisplay: { startsWith: "TEST-E2E-SM" } } });
  console.log(`cleanup: ${r.count} parts deleted`);
}

if (process.argv[2] === "cleanup") {
  await cleanup();
} else {
  await cleanup();
  const ti = await db().manufacturer.findUniqueOrThrow({ where: { slug: "texas-instruments" } });
  const amp = await db().category.findUniqueOrThrow({ where: { slug: "amplifiers" } });
  for (let i = 1; i <= 5; i++) {
    const { id } = await createDraftPart({ manufacturerId: ti.id, mpnDisplay: `TEST-E2E-SM${i}`, categoryId: amp.id, package: "SOIC-8" });
    await updatePart(id, {
      categoryId: amp.id,
      package: "SOIC-8",
      summaryKo: `TEST-E2E-SM${i}은 사이트맵 점검용 가상 부품입니다. 2026년 10월 기준 단종(EOL) 상태로 등록되어 있으며, 마지막 주문일은 2027년 3월 31일로 확인되어 있습니다.`,
      keySpecs: [
        { label: "채널 수", value: "2" },
        { label: "공급 전압", value: "3~32 V" },
        { label: "대역폭", value: "1 MHz" },
      ],
      lifecycleStatus: "eol",
      lifecycleCheckedAt: new Date(),
      lifecycleSource: "점검",
      eolDate: new Date("2027-03-31"),
      datasheetUrl: null,
    });
    await markReviewed(id, "e2e");
    await setPageStatus(id, "published");
  }
  console.log("created 5 indexable parts");
}
await db().$disconnect();
