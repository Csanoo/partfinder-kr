import Form from "next/form";

export function SearchForm({
  defaultQuery = "",
  defaultQty = "",
  size = "md",
  stacked = false,
}: {
  defaultQuery?: string;
  defaultQty?: string;
  size?: "md" | "lg";
  /** 좁은 칸용: 항상 세로 배치 */
  stacked?: boolean;
}) {
  const h = size === "lg" ? "h-12 text-base" : "h-10 text-sm";
  return (
    <Form
      action="/search"
      role="search"
      className={stacked ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center"}
    >
      <label className="flex-1">
        <span className="sr-only">품번</span>
        <input
          name="q"
          defaultValue={defaultQuery}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="제조사 품번(MPN) 입력  예: ULN2003A"
          className={`mpn w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-brand-500 placeholder:font-sans placeholder:text-muted focus-visible:ring-1 focus-visible:ring-brand-500 ${h}`}
        />
      </label>
      <div className="flex gap-2">
        <label className={stacked ? "flex-1" : "sm:w-32"}>
          <span className="sr-only">수량 (선택)</span>
          <input
            name="qty"
            type="number"
            min={1}
            step={1}
            defaultValue={defaultQty}
            placeholder="수량 (선택)"
            className={`w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-brand-500 placeholder:text-muted focus-visible:ring-1 focus-visible:ring-brand-500 ${h}`}
          />
        </label>
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-brand-600 px-6 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${h}`}
        >
          검색
        </button>
      </div>
    </Form>
  );
}
