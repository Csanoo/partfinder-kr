import Form from "next/form";

export function SearchForm({ defaultQuery = "", defaultQty = "" }: { defaultQuery?: string; defaultQty?: string }) {
  return (
    <Form action="/search" className="flex flex-col gap-2 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">품번</span>
        <input
          name="q"
          defaultValue={defaultQuery}
          required
          placeholder="제조사 품번(MPN) 입력"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="sm:w-36">
        <span className="sr-only">수량 (선택)</span>
        <input
          name="qty"
          type="number"
          min={1}
          step={1}
          defaultValue={defaultQty}
          placeholder="수량 (선택)"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
        검색
      </button>
    </Form>
  );
}
