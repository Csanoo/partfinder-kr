import Link from "next/link";

/** B. 견적 문의. 결과와 관계없이 항상 노출하며 중립적인 문구만 쓴다. */
export function QuoteInquiryBox({ mpn, qty }: { mpn: string; qty: number | null }) {
  return (
    <section
      aria-labelledby="quote-inquiry-heading"
      className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 id="quote-inquiry-heading" className="mb-1 font-semibold">
        견적 문의
      </h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">이 부품의 견적을 받아보세요.</p>
      <Link
        href={inquiryHref("/inquiry/quote", mpn, qty)}
        className="inline-block rounded border border-zinc-400 px-3 py-1.5 text-sm dark:border-zinc-600"
      >
        견적 문의하기
      </Link>
    </section>
  );
}

export function inquiryHref(path: string, mpn: string, qty: number | null): string {
  const params = new URLSearchParams({ mpn });
  if (qty != null) params.set("qty", String(qty));
  return `${path}?${params.toString()}`;
}
