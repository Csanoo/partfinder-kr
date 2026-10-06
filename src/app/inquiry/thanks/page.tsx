import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "요청 접수 완료", robots: { index: false, follow: false } };

export default async function ThanksPage(props: PageProps<"/inquiry/thanks">) {
  const { type } = await props.searchParams;
  const label = type === "sourcing" ? "소싱 문의" : type === "quote" ? "견적 문의" : "부품 요청";
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-md border border-line bg-surface px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-pcb-50 text-pcb-600 dark:bg-pcb-700/25 dark:text-pcb-100" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold">{label}{label === "부품 요청" ? "이" : "가"} 접수되었습니다</h1>
      <p className="text-muted">요청하신 부품을 찾아 담당자가 입력하신 연락처로 회신드리겠습니다.</p>
      <div className="flex justify-center gap-2">
        <Link href="/request" className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          다른 부품 요청하기
        </Link>
        <Link href="/" className="inline-flex rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-brand-500">
          홈으로
        </Link>
      </div>
    </div>
  );
}
