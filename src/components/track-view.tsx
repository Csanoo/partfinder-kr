"use client";

import { useEffect } from "react";
import { track } from "@/lib/client/track";
import type { EventType } from "@/lib/events";

/** 화면이 열릴 때 이벤트 1회 (예: 부품 페이지 조회, 소싱 문의 페이지 열기) */
export function TrackOnMount({ type, partId }: { type: EventType; partId?: string | null }) {
  useEffect(() => {
    track(type, partId);
  }, [type, partId]);
  return null;
}
