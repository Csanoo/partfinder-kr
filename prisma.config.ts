import { defineConfig, env } from "prisma/config";

// Prisma CLI는 .env를 자동으로 읽지 않으므로 Node 내장 기능으로 불러온다.
try {
  process.loadEnvFile(".env");
} catch {
  // .env 가 없으면 환경변수를 그대로 사용
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
