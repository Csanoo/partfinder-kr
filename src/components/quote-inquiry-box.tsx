import Link from "next/link";

/** B. 견적 문의. 결과와 관계없이 항상 노출하며 중립적인 문구만 쓴다. */
export function QuoteInquiryBox({
  mpn,
  qty,
  searchLogId = null,
}: {
  mpn: string;
  qty: number | null;
  searchLogId?: string | null;
}) {
  return (
    <section aria-labelledby="quote-inquiry-heading" className="flex flex-col rounded-md border border-line bg-surface p-5">
      <h2 id="quote-inquiry-heading" className="mb-1 font-semibold">
        견적 문의
      </h2>
      <p className="mb-4 flex-1 text-sm text-muted">이 부품의 견적을 받아보세요.</p>
      <Link
        href={inquiryHref("/inquiry/quote", mpn, qty, searchLogId)}
        className="inline-flex w-fit items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        견적 문의하기
      </Link>
    </section>
  );
}

export function inquiryHref(path: string, mpn: string, qty: number | null, searchLogId: string | null = null): string {
  const params = new URLSearchParams({ mpn });
  if (qty != null) params.set("qty", String(qty));
  if (searchLogId) params.set("sl", searchLogId);
  return `${path}?${params.toString()}`;
}
