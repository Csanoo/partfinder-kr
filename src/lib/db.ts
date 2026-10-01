import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// 개발 서버 HMR에서 연결이 계속 늘지 않도록 globalThis에 하나만 둔다.
const g = globalThis as unknown as { __prisma?: PrismaClient };

export function db(): PrismaClient {
  if (g.__prisma) return g.__prisma;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // 세션 시간대를 UTC로 고정: 어댑터가 시각을 시간대 없이 보내므로, 서버 기본 시간대(예: Asia/Seoul)로 해석되면 9시간 어긋난다
  g.__prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: "-c TimeZone=UTC" }) });
  return g.__prisma;
}
