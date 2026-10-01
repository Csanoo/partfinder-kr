import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "문의 접수 완료", robots: { index: false, follow: false } };

export default async function ThanksPage(props: PageProps<"/inquiry/thanks">) {
  const { type } = await props.searchParams;
  const label = type === "sourcing" ? "소싱 문의" : "견적 문의";
  return (
    <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">{label}가 접수되었습니다</h1>
      <p className="text-zinc-600 dark:text-zinc-400">담당자가 확인 후 입력하신 연락처로 회신드리겠습니다.</p>
      <Link href="/" className="inline-block underline">
        다른 품번 검색하기
      </Link>
    </div>
  );
}
