import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// 개발 서버 HMR에서 연결이 계속 늘지 않도록 globalThis에 하나만 둔다.
const g = globalThis as unknown as { __prisma?: PrismaClient };

export function db(): PrismaClient {
  if (g.__prisma) return g.__prisma;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  g.__prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  return g.__prisma;
}
