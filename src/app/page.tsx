import { JsonLd } from "@/components/json-ld";
import { SearchForm } from "@/components/search-form";
import { site } from "@/lib/site";

const faq = [
  {
    question: `${site.name}에서는 무엇을 할 수 있나요?`,
    answer:
      "전자부품 제조사 품번(MPN)을 입력하면 정식 유통사별 재고와 수량별 단가를 한 화면에서 비교할 수 있습니다. 모든 가격·재고에는 유통사명과 조회 시각, 상품 페이지 링크가 함께 표시됩니다.",
  },
  {
    question: "정식 유통사에 재고가 없으면 어떻게 하나요?",
    answer:
      "견적 문의 또는 브로커 소싱 문의를 남길 수 있습니다. 브로커 소싱은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.",
  },
  {
    question: "가격은 실시간인가요?",
    answer: "검색 시점에 유통사 데이터를 조회하며, 짧은 시간 동안만 캐시합니다. 표시된 조회 시각을 기준으로 확인해 주세요.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl space-y-12 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }}
      />

      <section>
        <h1 className="mb-2 text-2xl font-semibold">전자부품 품번 검색</h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          제조사 품번으로 유통사별 가격과 재고를 확인하세요.
        </p>
        <SearchForm />
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-3 text-lg font-semibold">
          이용 방법
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>제조사 품번(MPN)과 필요 수량을 입력합니다.</li>
          <li>정식 유통사별 재고, 수량별 단가, 합계를 비교합니다.</li>
          <li>필요하면 견적 문의나 브로커 소싱 문의를 남깁니다.</li>
        </ol>
      </section>

      <section aria-labelledby="home-faq-heading">
        <h2 id="home-faq-heading" className="mb-3 text-lg font-semibold">
          자주 묻는 질문
        </h2>
        <dl className="space-y-3">
          {faq.map((f) => (
            <div key={f.question}>
              <dt className="font-medium">{f.question}</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
