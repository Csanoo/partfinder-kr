/**
 * UI/UX 확인용 데모 데이터 (개발 DB 전용). 품번은 모두 DEMO- 로 시작하는 가상 부품이다.
 *   npm run db:seed:demo          만들기 (이미 있으면 지우고 다시)
 *   npm run db:seed:demo -- clean 지우기
 */
process.loadEnvFile(".env");
if (process.env.NODE_ENV === "production") {
  console.error("운영 환경에서는 실행하지 않습니다.");
  process.exit(1);
}

import { db } from "@/lib/db";
import { addAlternative, addFaq, createDraftPart, markReviewed, setAlternativeVerified, setFaqPublished, setPageStatus, updatePart } from "@/lib/parts/admin";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function clean() {
  const parts = await db().part.findMany({ where: { mpnDisplay: { startsWith: "DEMO-" } }, select: { id: true } });
  const ids = parts.map((p) => p.id);
  await db().event.deleteMany({ where: { partId: { in: ids } } });
  await db().inquiry.deleteMany({ where: { mpn: { startsWith: "DEMO-" } } });
  const r = await db().part.deleteMany({ where: { id: { in: ids } } });
  console.log(`데모 부품 ${r.count}개 삭제`);
}

async function ensureTaxonomy() {
  const cats = [
    { slug: "amplifiers", nameKo: "증폭기", nameEn: "Amplifiers" },
    { slug: "interface", nameKo: "인터페이스 IC", nameEn: "Interface ICs" },
    { slug: "power-management", nameKo: "전원 관리 IC", nameEn: "Power Management" },
  ];
  for (const c of cats) await db().category.upsert({ where: { slug: c.slug }, create: c, update: {} });
  const mfrs = [
    { slug: "texas-instruments", nameKo: "텍사스 인스트루먼트", nameEn: "Texas Instruments" },
    { slug: "analog-devices", nameKo: "아날로그 디바이스", nameEn: "Analog Devices" },
  ];
  for (const m of mfrs) await db().manufacturer.upsert({ where: { slug: m.slug }, create: m, update: {} });
  const id = async (table: "category" | "manufacturer", slug: string) =>
    table === "category"
      ? (await db().category.findUniqueOrThrow({ where: { slug } })).id
      : (await db().manufacturer.findUniqueOrThrow({ where: { slug } })).id;
  return id;
}

interface Demo {
  mpn: string;
  mfr: string;
  cat: string;
  pkg: string;
  lifecycle: "active" | "nrnd" | "ltb" | "eol";
  checkedDaysAgo: number;
  eol?: string;
  summary: string;
  specs: [string, string][];
  alts?: { mpn: string; relation: "drop_in" | "similar" | "upgrade"; note: string; verified: boolean }[];
  faqs?: { q: string; a: string }[];
}

const DEMOS: Demo[] = [
  {
    mpn: "DEMO-OPA2358",
    mfr: "texas-instruments",
    cat: "amplifiers",
    pkg: "SOIC-8",
    lifecycle: "eol",
    checkedDaysAgo: 3,
    eol: "2027-03-31",
    summary:
      "DEMO-OPA2358은 텍사스 인스트루먼트의 2채널 범용 연산 증폭기(데모 데이터)로 3~32 V 단일 전원에서 동작합니다. 2026년 10월 기준 단종(EOL) 상태이며 최종 주문은 2027년 3월 31일까지이고, 핀 호환 대체품 1종이 확인되어 있습니다.",
    specs: [
      ["채널 수", "2"],
      ["공급 전압", "3~32 V"],
      ["대역폭", "0.7 MHz"],
      ["동작 온도", "0~70 °C"],
    ],
    alts: [
      { mpn: "DEMO-OPA2358B", relation: "drop_in", note: "핀 배치 동일, 오프셋 전압 개선", verified: true },
      { mpn: "DEMO-MCP6002", relation: "similar", note: "공급 전압 범위 다름 (1.8~6 V)", verified: false },
    ],
    faqs: [
      { q: "DEMO-OPA2358 대체품을 바로 쓸 수 있나요?", a: "핀 호환 대체품 DEMO-OPA2358B 가 확인되어 있습니다. 오프셋 전압 사양이 개선된 버전이라 대부분 그대로 교체할 수 있지만, 정밀 회로는 데이터시트로 확인을 권합니다." },
      { q: "단종 이후에도 구할 수 있나요?", a: "최종 주문일 이후에는 정식 유통 재고가 소진되면 브로커 소싱으로만 구할 수 있습니다. 소싱 문의를 남기시면 확인해 드립니다." },
    ],
  },
  {
    mpn: "DEMO-OPA2358B",
    mfr: "texas-instruments",
    cat: "amplifiers",
    pkg: "SOIC-8",
    lifecycle: "active",
    checkedDaysAgo: 3,
    summary:
      "DEMO-OPA2358B는 텍사스 인스트루먼트의 2채널 범용 연산 증폭기(데모 데이터)로 3~36 V 단일 전원에서 동작합니다. 2026년 10월 기준 양산(Active) 상태입니다.",
    specs: [
      ["채널 수", "2"],
      ["공급 전압", "3~36 V"],
      ["대역폭", "1.2 MHz"],
    ],
    faqs: [{ q: "기존 DEMO-OPA2358 과 핀 배치가 같나요?", a: "네, SOIC-8 패키지에서 핀 배치가 같습니다. 공급 전압 범위가 더 넓어 기존 회로에 그대로 쓸 수 있습니다." }],
  },
  {
    mpn: "DEMO-SN65CAN230",
    mfr: "texas-instruments",
    cat: "interface",
    pkg: "SOIC-8",
    lifecycle: "nrnd",
    checkedDaysAgo: 40,
    summary:
      "DEMO-SN65CAN230은 텍사스 인스트루먼트의 3.3 V CAN 트랜시버(데모 데이터)입니다. 2026년 8월 기준 신규 설계 비권장(NRND) 상태이며, 상위 호환 대체품 1종이 확인되어 있습니다.",
    specs: [
      ["공급 전압", "3.3 V"],
      ["최대 속도", "1 Mbps"],
      ["노드 수", "120"],
    ],
    alts: [{ mpn: "DEMO-TCAN1042", relation: "upgrade", note: "CAN FD 지원, 5 V 전원", verified: true }],
  },
  {
    mpn: "DEMO-TPS5433",
    mfr: "texas-instruments",
    cat: "power-management",
    pkg: "SOIC-8",
    lifecycle: "active",
    checkedDaysAgo: 10,
    summary:
      "DEMO-TPS5433은 텍사스 인스트루먼트의 강압형 DC-DC 컨버터(데모 데이터)로 입력 3.5~28 V, 출력 전류 3 A입니다. 2026년 9월 기준 양산(Active) 상태입니다.",
    specs: [
      ["입력 전압", "3.5~28 V"],
      ["출력 전류", "3 A"],
      ["스위칭 주파수", "570 kHz"],
    ],
  },
  {
    mpn: "DEMO-LM2596-ADJ",
    mfr: "texas-instruments",
    cat: "power-management",
    pkg: "TO-263-5",
    lifecycle: "ltb",
    checkedDaysAgo: 20,
    eol: "2026-12-31",
    summary:
      "DEMO-LM2596-ADJ는 텍사스 인스트루먼트의 가변 출력 강압 레귤레이터(데모 데이터)로 출력 전류 3 A입니다. 2026년 9월 기준 최종 구매 접수 중(LTB)이며 최종 주문은 2026년 12월 31일까지입니다.",
    specs: [
      ["입력 전압", "4.5~40 V"],
      ["출력 전류", "3 A"],
      ["스위칭 주파수", "150 kHz"],
    ],
    faqs: [{ q: "LTB 기간에 대량 확보가 가능한가요?", a: "최종 주문일까지는 정식 유통사를 통해 주문할 수 있습니다. 필요 수량과 납기를 견적 문의로 남기시면 확보 가능 여부를 확인해 드립니다." }],
  },
  {
    mpn: "DEMO-AD8221",
    mfr: "analog-devices",
    cat: "amplifiers",
    pkg: "SOIC-8",
    lifecycle: "active",
    checkedDaysAgo: 5,
    summary:
      "DEMO-AD8221은 아날로그 디바이스의 정밀 계측 증폭기(데모 데이터)로 ±2.3~±18 V 전원에서 동작합니다. 2026년 9월 기준 양산(Active) 상태입니다.",
    specs: [
      ["공급 전압", "±2.3~±18 V"],
      ["이득 범위", "1~1000"],
      ["CMRR", "80 dB"],
    ],
  },
];

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();
  const id = await ensureTaxonomy();
  const ids = new Map<string, string>();

  for (const p of DEMOS) {
    const { id: partId } = await createDraftPart({
      manufacturerId: await id("manufacturer", p.mfr),
      mpnDisplay: p.mpn,
      categoryId: await id("category", p.cat),
      package: p.pkg,
    });
    ids.set(p.mpn, partId);
    await updatePart(partId, {
      categoryId: await id("category", p.cat),
      package: p.pkg,
      summaryKo: p.summary,
      keySpecs: p.specs.map(([label, value]) => ({ label, value })),
      lifecycleStatus: p.lifecycle,
      lifecycleCheckedAt: daysAgo(p.checkedDaysAgo),
      lifecycleSource: "데모 데이터",
      eolDate: p.eol ? d(p.eol) : null,
      datasheetUrl: null,
    });
  }
  // 대체품·FAQ 는 부품이 모두 만들어진 뒤 (내부 페이지 연결)
  for (const p of DEMOS) {
    const partId = ids.get(p.mpn)!;
    for (const a of p.alts ?? []) {
      await addAlternative(partId, { altMpn: a.mpn, relation: a.relation, noteKo: a.note });
      if (a.verified) {
        const row = await db().partAlternative.findFirstOrThrow({ where: { partId }, orderBy: { createdAt: "desc" } });
        await setAlternativeVerified(row.id, true, "demo");
      }
    }
    for (const f of p.faqs ?? []) {
      await addFaq(partId, { questionKo: f.q, answerKo: f.a });
      const row = await db().partFaq.findFirstOrThrow({ where: { partId }, orderBy: { createdAt: "desc" } });
      await setFaqPublished(row.id, true);
    }
    await markReviewed(partId, "demo");
    await setPageStatus(partId, "published");
  }

  // 문의 몇 건 (관리자 화면 확인용)
  const demoInquiries = [
    { type: "sourcing" as const, mpn: "DEMO-OPA2358", qty: 2000, item: "eleven_plus" as const, src: "google", part: "DEMO-OPA2358", memo: "단종 후 대체품 검증 전까지 1년치 확보가 필요합니다." },
    { type: "quote" as const, mpn: "DEMO-TPS5433", qty: 500, item: "two_to_ten" as const, src: "naver", part: "DEMO-TPS5433", memo: null },
    { type: "sourcing" as const, mpn: "DEMO-LM2596-ADJ", qty: 300, item: "one" as const, src: "ai", part: "DEMO-LM2596-ADJ", memo: "LTB 이후 물량 문의" },
  ];
  for (const [i, q] of demoInquiries.entries()) {
    await db().inquiry.create({
      data: {
        type: q.type,
        mpn: q.mpn,
        qty: q.qty,
        dueNegotiable: true,
        itemCountBucket: q.item,
        purchaseType: "company",
        company: "데모 주식회사",
        contactName: "데모 담당자",
        phone: "010-0000-0000",
        email: "demo@example.com",
        memo: q.memo,
        consentPrivacy: true,
        consentThirdParty: q.type === "sourcing" ? true : null,
        consentTextVersion: "demo",
        status: i === 0 ? "new" : i === 1 ? "contacted" : "new",
        notifyStatus: "sent",
        trafficSource: q.src,
        landingUrl: `/parts/texas-instruments/${q.part.toLowerCase()}`,
        firstVisitAt: daysAgo(i + 1),
        partId: ids.get(q.part) ?? null,
      },
    });
  }
  console.log(`데모 부품 ${DEMOS.length}개, 문의 ${demoInquiries.length}건 생성`);
}

await main();
await db().$disconnect();
