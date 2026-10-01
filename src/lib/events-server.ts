import { decodeFirstTouch, ATTRIBUTION_COOKIE } from "@/lib/attribution";
import { db } from "@/lib/db";
import type { EventInput } from "@/lib/events";
import { SESSION_COOKIE } from "@/proxy";

type CookieReader = { get(name: string): { value: string } | undefined };

/** 이벤트 저장. 실패해도 사용자 동작에 영향을 주지 않는다 */
export async function recordEvent(input: EventInput, cookies: CookieReader): Promise<void> {
  try {
    const touch = decodeFirstTouch(cookies.get(ATTRIBUTION_COOKIE)?.value);
    // 존재하지 않는 부품 ID 는 버린다 (외래 키 오류 방지)
    const partId = input.partId ? ((await db().part.findUnique({ where: { id: input.partId }, select: { id: true } }))?.id ?? null) : null;
    await db().event.create({
      data: {
        type: input.type,
        partId,
        path: input.path,
        sessionId: cookies.get(SESSION_COOKIE)?.value ?? null,
        trafficSource: touch?.trafficSource ?? null,
      },
    });
  } catch (err) {
    console.error("[event] record failed:", err);
  }
}
