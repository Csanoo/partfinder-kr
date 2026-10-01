/**
 * 개발용 샘플 데이터 (실제 게시 부품 목록이 아님).
 * 여러 번 실행해도 같은 결과가 되도록 이미 있으면 건너뛴다.
 * 실행: npm run db:seed
 */
import type { PageStatus } from "@/generated/prisma/enums";
import { db as getDb } from "@/lib/db";
import { addVariant, createPart } from "@/lib/parts/service";
import { mpnKey } from "@/lib/parts/slug";

process.loadEnvFile(".env");
// 공용 연결 사용 (세션 시간대 UTC 고정 포함)
const db = getDb();

const manufacturers = [
  { slug: "texas-instruments", nameKo: "텍사스 인스트루먼트", nameEn: "Texas Instruments" },
  { slug: "analog-devices", nameKo: "아날로그 디바이스", nameEn: "Analog Devices" },
  { slug: "microchip", nameKo: "마이크로칩", nameEn: "Microchip Technology" },
];

const categories = [
  { slug: "amplifiers", nameKo: "증폭기", nameEn: "Amplifiers" },
  { slug: "interface", nameKo: "인터페이스 IC", nameEn: "Interface ICs" },
];

const parts: { mfr: string; cat: string; mpn: string; pkg: string; status: PageStatus; variants?: string[] }[] = [
  { mfr: "texas-instruments", cat: "amplifiers", mpn: "LM358-N/NOPB", pkg: "SOIC-8", status: "published" },
  { mfr: "analog-devices", cat: "amplifiers", mpn: "AD8221ARZ", pkg: "SOIC-8", status: "published", variants: ["AD8221ARZ-R7", "AD8221ARZ-RL"] },
  { mfr: "microchip", cat: "interface", mpn: "MCP2551-I/SN", pkg: "SOIC-8", status: "unpublished" },
  { mfr: "texas-instruments", cat: "interface", mpn: "SN65HVD230DR", pkg: "SOIC-8", status: "draft" },
];

async function main() {
  const mfrIds = new Map<string, string>();
  for (const m of manufacturers) {
    const row = await db.manufacturer.upsert({ where: { slug: m.slug }, create: m, update: {}, select: { id: true } });
    mfrIds.set(m.slug, row.id);
  }
  const catIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.upsert({ where: { slug: c.slug }, create: c, update: {}, select: { id: true } });
    catIds.set(c.slug, row.id);
  }

  for (const p of parts) {
    const manufacturerId = mfrIds.get(p.mfr)!;
    const existing = await db.part.findUnique({
      where: { manufacturerId_mpnKey: { manufacturerId, mpnKey: mpnKey(p.mpn) } },
      select: { id: true },
    });
    if (existing) continue;
    const { id, slug } = await createPart(db, {
      manufacturerId,
      mpnDisplay: p.mpn,
      categoryId: catIds.get(p.cat),
      package: p.pkg,
      pageStatus: p.status,
    });
    for (const v of p.variants ?? []) await addVariant(db, id, v);
    console.log(`created ${p.mfr}/${slug} (${p.status})`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
