/** 개인정보 보유기간 경과분 파기. 실행: npm run privacy:purge (PERSONAL_DATA_RETENTION_DAYS 필요) */
process.loadEnvFile(".env");

import { db } from "@/lib/db";
import { purgeExpiredPersonalData } from "@/lib/inquiry/retention";

console.log(await purgeExpiredPersonalData());
await db().$disconnect();
