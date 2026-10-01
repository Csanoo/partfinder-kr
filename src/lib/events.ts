/** 측정 이벤트 (docs/SEO_SPEC.md 8장) */
export const EVENT_TYPES = ["part_view", "availability_view", "sourcing_form_open", "inquiry_submit"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 브라우저에서 보낼 수 있는 이벤트 (문의 제출은 서버에서만 기록) */
export const CLIENT_EVENT_TYPES: readonly EventType[] = ["part_view", "availability_view", "sourcing_form_open"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EventInput {
  type: EventType;
  partId: string | null;
  path: string | null;
}

/** /api/events 요청 본문 검증 */
export function parseClientEvent(body: unknown): EventInput | null {
  if (typeof body !== "object" || body == null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string" || !CLIENT_EVENT_TYPES.includes(b.type as EventType)) return null;
  const partId = typeof b.partId === "string" && UUID_RE.test(b.partId) ? b.partId : null;
  const path = typeof b.path === "string" && b.path.startsWith("/") ? b.path.slice(0, 300) : null;
  return { type: b.type as EventType, partId, path };
}
