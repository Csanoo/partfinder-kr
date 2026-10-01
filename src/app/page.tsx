import { SearchForm } from "@/components/search-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="mb-2 text-2xl font-semibold">전자부품 품번 검색</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        제조사 품번으로 유통사별 가격과 재고를 확인하세요.
      </p>
      <SearchForm />
    </div>
  );
}
