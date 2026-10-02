import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 배포 후 상태 확인 (앱 + DB). 외부 노출되어도 내부 정보를 담지 않는다 */
export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
