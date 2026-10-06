import { submitPartRequest } from "@/app/inquiry/actions";
import { HubLinks } from "@/components/hub-links";
import { JsonLd } from "@/components/json-ld";
import { RequestForm } from "@/components/request-form";
import { RequestSteps } from "@/components/request-steps";
import { SearchForm } from "@/components/search-form";
import { consentTexts } from "@/lib/inquiry/consent";
import { site } from "@/lib/site";

/** 홈 FAQ (구조화 데이터 FAQPage 로도 내보낸다 — 검색·AI 답변에 서비스 성격이 그대로 전달되도록) */
const faq = [
  {
    question: `${site.name}는 어떤 서비스인가요?`,
    answer: `${site.name}는 필요한 전자부품을 찾아서 공급하는 부품 요청 서비스입니다. 품번(MPN)과 수량을 알려주시면 정식 유통사 재고를 먼저 확인하고, 재고가 없거나 단종·품귀인 부품은 국내외 공급처를 찾아 가격·납기·출처를 정리해 회신드립니다.`,
  },
  {
    question: "단종되었거나 구하기 어려운 부품도 찾을 수 있나요?",
    answer:
      "네. 단종(EOL)·생산 중단 예정(NRND)·품귀 부품도 요청하실 수 있습니다. 공급처를 찾아 출처와 조건을 함께 안내드리고, 공급이 어려운 경우에는 핀 호환 대체품을 제안드립니다. 정식 유통 경로 외 소싱 부품은 정품 보증·반품 조건이 정식 유통사와 다를 수 있습니다.",
  },
  {
    question: "여러 품목을 한 번에 요청할 수 있나요?",
    answer: "네. 품목을 여러 줄로 입력하거나 엑셀에서 품번·수량 두 열을 붙여넣을 수 있고, BOM 파일(xlsx·csv·pdf 등)을 첨부해도 됩니다.",
  },
  {
    question: "요청하면 비용이 드나요?",
    answer: "요청과 견적 회신은 무료입니다. 가격·납기를 확인하신 뒤 구매 여부를 결정하시면 됩니다.",
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
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

      <section aria-labelledby="request-heading" className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <div>
            <h1 id="request-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              필요한 전자부품, 찾아서 공급해 드립니다
            </h1>
            <p className="mt-2 text-muted">
              품번과 수량만 알려주세요. 정식 유통 재고부터 단종·품귀 부품까지 공급처를 찾아 가격·납기를 회신드립니다.
            </p>
          </div>
          <RequestForm action={submitPartRequest} defaults={{}} consent={consentTexts()} />
        </div>

        <div className="space-y-8">
          <RequestSteps />
          <section aria-labelledby="stock-heading" className="space-y-2 border-t border-line pt-4">
            <h2 id="stock-heading" className="text-base font-bold">
              재고 먼저 확인하기
            </h2>
            <p className="text-sm text-muted">정식 유통사 재고를 바로 조회할 수 있습니다.</p>
            <SearchForm stacked />
          </section>
        </div>
      </section>

      <HubLinks />

      <section aria-labelledby="home-faq-heading" className="max-w-3xl">
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
      </section>
    </div>
  );
}
