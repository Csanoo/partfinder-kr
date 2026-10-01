/**
 * 정식 유통사 재고 영역 (SEO_SPEC 6.4).
 * 서버 렌더링 시점에는 유통사 데이터를 넣지 않는다 (제약 3). 레이아웃 이동이 없도록 고정 높이.
 * TODO: 6단계에서 브라우저 측 /api/availability 호출로 교체 (봇에는 호출하지 않음)
 */
export function AvailabilityPanel({ mpn }: { mpn: string }) {
  return (
    <div className="flex h-28 flex-col justify-center rounded-lg border border-dashed border-line px-4 text-sm text-muted" data-mpn={mpn}>
      <p>정식 유통사 재고는 방문 시 조회해 보여 드립니다.</p>
      <p className="text-xs">재고 있음/없음과 유통사 링크만 표시하며, 가격은 표시하지 않습니다.</p>
    </div>
  );
}
