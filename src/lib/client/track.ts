"use client";

import type { EventType } from "@/lib/events";

/** 측정 이벤트 전송 (페이지를 떠나도 전송되도록 sendBeacon 우선) */
export function track(type: EventType, partId?: string | null) {
  try {
    const body = JSON.stringify({ type, partId: partId ?? null, path: location.pathname });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/events", blob)) return;
    void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // 측정 실패는 무시
  }
}
