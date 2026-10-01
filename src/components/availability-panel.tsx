"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/client/track";
import type { AvailabilityResponse, AvailabilityRow, AvailabilityStatus } from "@/lib/availability";

/**
 * 정식 유통사 재고 영역 (SEO_SPEC 6.4).
 * - 서버 렌더링 HTML에는 유통사 데이터를 넣지 않고, 페이지 로드 후 브라우저에서 /api/availability 를 호출한다.
 * - 검색엔진 봇(isBot)에는 호출하지 않고 안내 문구만.
 * - 레이아웃 이동이 없도록 고정 높이.
 */

const BOX = "h-44 overflow-y-auto rounded-lg border border-line";

const LABEL: Record<AvailabilityStatus, string> = {
  in_stock: "재고 있음",
  out_of_stock: "재고 없음",
  unknown: "재고 미표기",
  no_results: "검색 결과 없음",
  unavailable: "일시적으로 조회 불가",
};

const TONE: Record<AvailabilityStatus, string> = {
  in_stock: "bg-pcb-50 text-pcb-700 dark:bg-pcb-700/25 dark:text-pcb-100",
  out_of_stock: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  unknown: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  no_results: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  unavailable: "bg-copper-50 text-copper-700 dark:bg-copper-700/20 dark:text-copper-200",
};

type State = { phase: "loading" } | { phase: "done"; rows: AvailabilityRow[] } | { phase: "error"; message: string };

function time(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

export function AvailabilityPanel({ mpn, isBot = false, partId = null }: { mpn: string; isBot?: boolean; partId?: string | null }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const boxRef = useRef<HTMLDivElement>(null);

  // 측정: 재고 영역이 화면에 들어오면 1회 (SEO_SPEC 8장)
  useEffect(() => {
    if (isBot || !boxRef.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        track("availability_view", partId);
        io.disconnect();
      }
    });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [isBot, partId]);

  useEffect(() => {
    if (isBot) return;
    const ctrl = new AbortController();
    fetch(`/api/availability?mpn=${encodeURIComponent(mpn)}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = (await res.json()) as AvailabilityResponse;
        if (body.kind === "ok") setState({ phase: "done", rows: body.rows });
        else if (body.kind === "rate_limited") setState({ phase: "error", message: "요청이 많아 잠시 후 다시 조회해 주세요." });
        else setState({ phase: "error", message: "재고를 조회하지 못했습니다." });
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ phase: "error", message: "일시적으로 조회 불가" });
      });
    return () => ctrl.abort();
  }, [mpn, isBot]);

  if (isBot) {
    return (
      <div className={`${BOX} flex items-center px-4 text-sm text-muted`}>
        <p>정식 유통사 재고 조회는 방문 시 제공합니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={boxRef} className={BOX} aria-live="polite" aria-busy={state.phase === "loading"}>
        {state.phase === "loading" && (
          <ul className="divide-y divide-line" aria-label="재고 조회 중">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-11 items-center gap-3 px-4">
                <span className="h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <span className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </li>
            ))}
          </ul>
        )}
        {state.phase === "error" && <p className="flex h-full items-center px-4 text-sm text-copper-700 dark:text-copper-200">{state.message}</p>}
        {state.phase === "done" && state.rows.length === 0 && (
          <p className="flex h-full items-center px-4 text-sm text-muted">현재 조회 가능한 유통사가 없습니다.</p>
        )}
        {state.phase === "done" && state.rows.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {state.rows.map((r) => (
              <li key={r.providerName} className="flex h-11 items-center justify-between gap-3 px-4">
                <span className="font-medium">{r.providerName}</span>
                <span className="flex items-center gap-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</span>
                  <span className="hidden text-xs text-muted sm:inline">{time(r.fetchedAt)}</span>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="whitespace-nowrap text-xs text-brand-600 hover:underline dark:text-brand-300">
                      유통사 페이지 ↗
                    </a>
                  ) : (
                    <span className="w-[5.5rem]" aria-hidden="true" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">재고 있음/없음과 유통사 링크만 표시합니다. 가격과 수량은 견적 문의로 안내합니다.</p>
    </div>
  );
}
