import { cookies } from "next/headers";
import { parseClientEvent } from "@/lib/events";
import { recordEvent } from "@/lib/events-server";
import { ProviderRateLimiter } from "@/lib/providers/rate-limiter";
import { isBot } from "@/lib/search/search-log";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __eventLimiter?: ProviderRateLimiter };
const limiter = (g.__eventLimiter ??= new ProviderRateLimiter());

/** POST /api/events — 브라우저 측정 이벤트 (봇·과도한 요청은 조용히 버린다) */
export async function POST(req: Request) {
  if (isBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.tryAcquire(`event:${ip}`, { perMinute: 120 }).ok) return new Response(null, { status: 204 });

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = parseClientEvent(body);
  if (!event) return new Response(null, { status: 400 });
  await recordEvent(event, await cookies());
  return new Response(null, { status: 204 });
}
