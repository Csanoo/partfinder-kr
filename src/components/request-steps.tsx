/** 부품 요청 진행 순서 안내 (요청 페이지·홈 옆 칸) */
export function RequestSteps() {
  return (
    <aside aria-labelledby="steps-heading" className="h-fit space-y-4 text-sm lg:sticky lg:top-20">
      <h2 id="steps-heading" className="text-base font-bold">
        이렇게 진행됩니다
      </h2>
      <ol className="space-y-3">
        {[
          ["요청 접수", "품번·수량을 남기거나 BOM 파일을 첨부합니다."],
          ["재고 확인", "정식 유통사 재고를 먼저 확인하고, 없으면 단종·품귀 부품까지 공급처를 찾습니다."],
          ["견적 회신", "가격·납기·출처를 정리해 담당자가 연락드립니다."],
        ].map(([title, body], i) => (
          <li key={title} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span className="mpn text-sm font-bold text-brand-600 dark:text-brand-300">{i + 1}</span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-3 text-xs text-muted">
        소싱 부품(정식 유통 경로 외)을 제안하는 경우 출처와 조건을 함께 안내드리며, 정품 보증·반품 조건은 정식 유통사와 다를 수 있습니다.
      </p>
    </aside>
  );
}
