// prisma migrate dev (추가 인자 그대로 전달) → prisma generate
// 사용: npm run db:migrate -- --name add_something
import { spawnSync } from "node:child_process";

const run = (args) => {
  const r = spawnSync("npx", ["prisma", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(["migrate", "dev", ...process.argv.slice(2)]);
run(["generate"]);
