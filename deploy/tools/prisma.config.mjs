// 운영 서버의 마이그레이션 전용 Prisma 설정 (/opt/partfinder/tools 에 설치).
// standalone 앱에는 Prisma CLI 가 없으므로, 릴리스에 담긴 schema·migrations 경로를 환경변수로 받아 적용한다.
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: env("PRISMA_SCHEMA"),
  migrations: { path: env("PRISMA_MIGRATIONS") },
  datasource: { url: env("DATABASE_URL") },
});
