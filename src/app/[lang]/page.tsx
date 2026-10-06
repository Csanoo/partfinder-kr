import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HubLinks } from "@/components/hub-links";
import { JsonLd } from "@/components/json-ld";
import { SearchForm } from "@/components/search-form";
import { hasLocale, localePath } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n";
import { alternatesFor } from "@/i18n/seo";
import { siteName } from "@/lib/site";

export async function generateMetadata(props: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!hasLocale(lang)) return {};
  return { alternates: alternatesFor(lang, "/") };
}

/** 홈 = 서비스 소개. 요청은 /request (빠른 입력창은 품번·수량을 들고 요청 페이지로 보낸다) */
export default async function Home(props: PageProps<"/[lang]">) {
  const { lang } = await props.params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).home;
  const lp = (p: string) => localePath(lang, p);
  const site = siteName(lang);
  // FAQ 는 구조화 데이터(FAQPage)로도 내보낸다 — 검색·AI 답변에 서비스 성격이 그대로 전달되도록
  const faq = t.faq.map((f) => ({ question: fmt(f.q, { site }), answer: fmt(f.a, { site }) }));
  const input =
    "h-12 w-full rounded-md border border-line bg-surface px-3 outline-none placeholder:text-muted focus:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500";

  return (
    <div className="space-y-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }}
      />

      {/* 소개 + 빠른 요청 */}
      <section aria-labelledby="hero-heading" className="max-w-3xl space-y-6 pt-4">
        <div className="space-y-3">
          <h1 id="hero-heading" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t.h1}
          </h1>
          <p className="text-lg leading-relaxed text-muted">{t.lead}</p>
        </div>
        <Form action={lp("/request")} className="flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">{t.quickMpn}</span>
            <input name="mpn" required maxLength={64} autoComplete="off" spellCheck={false} placeholder={t.quickMpn} className={`${input} mpn text-base placeholder:font-sans`} />
          </label>
          <div className="flex gap-2">
            <label className="w-28">
              <span className="sr-only">{t.quickQty}</span>
              <input name="qty" type="number" min={1} step={1} placeholder={t.quickQty} className={input} />
            </label>
            <button type="submit" className="h-12 shrink-0 rounded-md bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700">
              {t.quickSubmit}
            </button>
          </div>
        </Form>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href={lp("/request")} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            {t.quickBom}
          </Link>
          <span className="text-muted">{t.quickNote}</span>
        </p>
      </section>

      {/* 이런 부품을 찾아드립니다 */}
      <section aria-labelledby="what-heading" className="space-y-5">
        <h2 id="what-heading" className="text-xl font-bold">
          {t.whatTitle}
        </h2>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {t.what.map((w) => (
            <div key={w.title} className="border-l-2 border-brand-600 pl-4">
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 진행 방식 */}
      <section aria-labelledby="process-heading" className="space-y-5">
        <h2 id="process-heading" className="text-xl font-bold">
          {t.processTitle}
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {t.process.map((s, i) => (
            <li key={s.title} className="bg-surface p-5">
              <span className="mpn text-sm font-bold text-brand-600 dark:text-brand-300">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 취급 분야 */}
      <section aria-labelledby="areas-heading" className="space-y-5">
        <div>
          <h2 id="areas-heading" className="text-xl font-bold">
            {t.areasTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.areasLead}</p>
        </div>
        <dl className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
          {t.areas.map((a) => (
            <div key={a.title} className="grid grid-cols-[8.5rem_1fr] gap-3 border-b border-line py-3 text-sm">
              <dt className="font-semibold">{a.title}</dt>
              <dd className="text-muted">{a.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 부품 둘러보기 + 재고 조회 */}
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <HubLinks locale={lang} />
        <section aria-labelledby="stock-heading" className="space-y-2">
          <h2 id="stock-heading" className="text-base font-bold">
            {t.stockTitle}
          </h2>
          <p className="text-sm text-muted">{t.stockLead}</p>
          <SearchForm stacked locale={lang} />
        </section>
      </div>

      {/* FAQ */}
      <section aria-labelledby="home-faq-heading" className="max-w-3xl">
        <h2 id="home-faq-heading" className="mb-3 text-xl font-bold">
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
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 마무리 요청 유도 */}
      <section
        aria-labelledby="cta-heading"
        className="flex flex-col gap-4 rounded-md bg-brand-800 px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between dark:bg-brand-900"
      >
        <div>
          <h2 id="cta-heading" className="text-xl font-bold">
            {t.ctaTitle}
          </h2>
          <p className="mt-1 text-sm text-brand-100">{t.ctaLead}</p>
        </div>
        <Link href={lp("/request")} className="inline-flex w-fit shrink-0 items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">
          {t.ctaButton}
        </Link>
      </section>
    </div>
  );
}
