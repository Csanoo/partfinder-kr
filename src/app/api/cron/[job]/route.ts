import { CRON_JOBS, isCronJob, verifyCronSecret } from "@/lib/cron-jobs";

export const dynamic = "force-dynamic";
// 제조사 정보 조회는 요청 간격 때문에 길어질 수 있다
export const maxDuration = 900;

export async function POST(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return new Response("Not Found", { status: 404 });
  const { job } = await ctx.params;
  if (!isCronJob(job)) return new Response("Not Found", { status: 404 });
  const started = Date.now();
  try {
    const result = await CRON_JOBS[job]();
    console.log(`[cron] ${job} done in ${Date.now() - started}ms`, result);
    return Response.json({ ok: true, job, result });
  } catch (err) {
    console.error(`[cron] ${job} failed:`, err);
    return Response.json({ ok: false, job }, { status: 500 });
  }
}
