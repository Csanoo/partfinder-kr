import { HubLinks } from "@/components/hub-links";
import { JsonLd } from "@/components/json-ld";
import { SearchForm } from "@/components/search-form";
import { site } from "@/lib/site";

const faq = [
  {
    question: `${site.name}에서는 무엇을 할 수 있나요?`,
    answer:
      "전자부품 제조사 품번(MPN)을 입력하면 정식 유통사별 재고를 한 화면에서 확인할 수 있습니다. 모든 재고 정보에는 유통사명과 조회 시각, 상품 페이지 링크가 함께 표시됩니다.",
  },
  {
    question: "정식 유통사에 재고가 없으면 어떻게 하나요?",
    answer:
      "견적 문의 또는 소싱 문의를 남길 수 있습니다. 소싱 부품은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.",
  },
  {
    question: "재고 정보는 실시간인가요?",
    answer:
      "검색 시점에 유통사 데이터를 조회하며, 짧은 시간 동안만 캐시합니다. 표시된 조회 시각을 기준으로 확인해 주세요. 가격은 견적 문의로 안내드립니다.",
  },
];

const facts = [
  { title: "정식 유통사 재고", body: "유통사별 재고·최소 주문 수량을 출처와 조회 시각과 함께 표시" },
  { title: "단종·NRND 확인", body: "유통사 표기 기준 수명주기 상태를 함께 표시" },
  { title: "견적·소싱 문의", body: "정식 유통사에서 구하기 어려운 부품은 소싱 문의" },
];

export default function Home() {
  return (
    <div className="space-y-10">
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

      <section className="space-y-4 border-b border-line pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전자부품 품번 검색</h1>
          <p className="mt-1 text-sm text-muted">
            제조사 품번(MPN)으로 정식 유통사 재고와 단종 여부를 확인하고, 구하기 어려운 부품은 견적·소싱을 문의하세요.
          </p>
        </div>
        <SearchForm size="lg" />
        <dl aria-label="주요 기능" className="grid gap-x-8 gap-y-3 pt-2 text-sm sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.title} className="border-l-2 border-brand-600 pl-3">
              <dt className="font-semibold">{f.title}</dt>
              <dd className="text-muted">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <HubLinks />

      <section aria-labelledby="how-heading" className="grid gap-8 md:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 id="how-heading" className="mb-3 text-base font-bold">
            이용 방법
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm marker:font-semibold marker:text-muted">
            {[
              "제조사 품번(MPN)과 필요 수량을 입력합니다.",
              "정식 유통사별 재고와 단종 여부를 확인합니다.",
              "필요하면 견적 문의나 소싱 문의를 남깁니다.",
            ].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div aria-labelledby="home-faq-heading">
          <h2 id="home-faq-heading" className="mb-3 text-base font-bold">
            자주 묻는 질문
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <details key={f.question} className="group py-3" open>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                  {f.question}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-1.5 text-sm text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
