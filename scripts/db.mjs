// 로컬 개발용 PostgreSQL (프로젝트 내 .pgdata) 실행·중지
// 사용: node scripts/db.mjs start|stop|status
// PG_BIN 환경변수로 PostgreSQL bin 경로를 바꿀 수 있다.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.PG_DEV_PORT ?? "5434";
const binDir = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const pgCtl = join(binDir, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
const dataDir = join(process.cwd(), ".pgdata");

const cmd = process.argv[2];
if (!["start", "stop", "status"].includes(cmd)) {
  console.error("usage: node scripts/db.mjs start|stop|status");
  process.exit(2);
}
if (!existsSync(pgCtl)) {
  console.error(`pg_ctl not found: ${pgCtl} (PG_BIN 환경변수로 경로 지정)`);
  process.exit(1);
}
if (!existsSync(dataDir)) {
  console.error(".pgdata 가 없습니다. initdb 로 먼저 만들어 주세요 (README 참고).");
  process.exit(1);
}

const args = ["-D", dataDir];
if (cmd === "start") args.push("-l", join(dataDir, "server.log"), "-o", `-p ${PORT}`, "-w", "start");
else args.push(cmd);

// start 시 stdout/stderr를 상속하면 서버 프로세스가 파이프를 계속 잡고 있어 명령이 끝나지 않는다.
const r = spawnSync(pgCtl, args, { stdio: cmd === "start" ? ["ignore", "ignore", "ignore"] : "inherit" });
if (cmd === "start") {
  console.log(r.status === 0 ? `dev DB started on port ${PORT} (log: .pgdata/server.log)` : "start failed (see .pgdata/server.log)");
}
process.exit(r.status ?? 1);
