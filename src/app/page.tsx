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
      "견적 문의 또는 브로커 소싱 문의를 남길 수 있습니다. 브로커 소싱은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.",
  },
  {
    question: "재고 정보는 실시간인가요?",
    answer:
      "검색 시점에 유통사 데이터를 조회하며, 짧은 시간 동안만 캐시합니다. 표시된 조회 시각을 기준으로 확인해 주세요. 가격은 견적 문의로 안내드립니다.",
  },
];

const features = [
  {
    title: "정식 유통사 재고",
    body: "유통사별 재고와 최소 주문 수량을 출처·조회 시각과 함께 확인합니다.",
    icon: (
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    ),
  },
  {
    title: "단종·NRND 확인",
    body: "유통사 표기 기준 수명주기 상태를 함께 보여 드립니다.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "견적·소싱 문의",
    body: "정식 유통사에서 구하기 어려운 부품은 소싱 문의를 남기세요.",
    icon: (
      <path d="M4 6h16v10H8l-4 4V6z" strokeLinejoin="round" />
    ),
  },
];

export default function Home() {
  return (
    <div className="space-y-14">
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

      <section className="bg-circuit -mx-4 overflow-hidden px-4 py-16 sm:mx-0 sm:rounded-2xl sm:px-10 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-900/50 px-3 py-1 text-xs font-medium text-brand-200">
            <span className="size-1.5 rounded-full bg-copper-400" />
            전자부품 품번 검색
          </p>
          <h1 className="mb-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
            찾는 부품, 품번 하나로
            <br />
            재고부터 소싱까지
          </h1>
          <p className="mb-8 text-brand-100/80">
            제조사 품번으로 정식 유통사 재고를 확인하고, 구하기 어려운 부품은 견적·소싱을 문의하세요.
          </p>
          <SearchForm size="lg" />
        </div>
      </section>

      <section aria-label="주요 기능" className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
            <svg
              viewBox="0 0 24 24"
              className="mb-3 size-9 rounded-lg bg-brand-50 p-1.5 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              {f.icon}
            </svg>
            <h2 className="mb-1 font-semibold">{f.title}</h2>
            <p className="text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="how-heading" className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="how-heading" className="mb-4 text-xl font-bold">
            이용 방법
          </h2>
          <ol className="space-y-4">
            {[
              "제조사 품번(MPN)과 필요 수량을 입력합니다.",
              "정식 유통사별 재고와 단종 여부를 확인합니다.",
              "필요하면 견적 문의나 브로커 소싱 문의를 남깁니다.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mpn flex size-7 shrink-0 items-center justify-center rounded-md bg-copper-500 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div aria-labelledby="home-faq-heading">
          <h2 id="home-faq-heading" className="mb-4 text-xl font-bold">
            자주 묻는 질문
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {faq.map((f) => (
              <details key={f.question} className="group p-4" open>
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.question}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
