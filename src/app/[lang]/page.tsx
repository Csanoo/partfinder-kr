import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubLinks } from "@/components/hub-links";
import { JsonLd } from "@/components/json-ld";
import { RequestForm } from "@/components/request-form";
import { RequestSteps } from "@/components/request-steps";
import { SearchForm } from "@/components/search-form";
import { hasLocale } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { alternatesFor } from "@/i18n/seo";
import { submitPartRequest } from "@/lib/inquiry/actions";
import { consentFor } from "@/lib/inquiry/consent";
import { siteName } from "@/lib/site";

export async function generateMetadata(props: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!hasLocale(lang)) return {};
  return { alternates: alternatesFor(lang, "/") };
}

export default async function Home(props: PageProps<"/[lang]">) {
  const { lang } = await props.params;
  if (!hasLocale(lang)) notFound();
  const d = getDictionary(lang);
  const t = d.home;
  // 홈 FAQ (구조화 데이터 FAQPage 로도 내보낸다 — 검색·AI 답변에 서비스 성격이 그대로 전달되도록)
  const faq = t.faq.map((f) => ({ question: fmt(f.q, { site: siteName(lang) }), answer: fmt(f.a, { site: siteName(lang) }) }));
  return (
    <div className="space-y-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
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
              {t.h1}
            </h1>
            <p className="mt-2 text-muted">{t.lead}</p>
          </div>
          <RequestForm action={submitPartRequest} defaults={{}} consent={consentFor(lang)} t={d.form} locale={lang} />
        </div>

        <div className="space-y-8">
          <RequestSteps locale={lang} />
          <section aria-labelledby="stock-heading" className="space-y-2 border-t border-line pt-4">
            <h2 id="stock-heading" className="text-base font-bold">
              {t.stockTitle}
            </h2>
            <p className="text-sm text-muted">{t.stockLead}</p>
            <SearchForm stacked locale={lang} />
          </section>
        </div>
      </section>

      <HubLinks locale={lang} />

      <section aria-labelledby="home-faq-heading" className="max-w-3xl">
        <h2 id="home-faq-heading" className="mb-3 text-base font-bold">
          {t.faqTitle}
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
