import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";

export async function generateMetadata(props: PageProps<"/[lang]/inquiry/thanks">): Promise<Metadata> {
  const { lang } = await props.params;
  return { title: getDictionary(hasLocale(lang) ? lang : undefined).request.thanksMetaTitle, robots: { index: false, follow: false } };
}

export default async function ThanksPage(props: PageProps<"/[lang]/inquiry/thanks">) {
  const { lang } = await props.params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).request;
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-md border border-line bg-surface px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-pcb-50 text-pcb-600 dark:bg-pcb-700/25 dark:text-pcb-100" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold">{t.thanksTitle}</h1>
      <p className="text-muted">{t.thanksLead}</p>
      <div className="flex justify-center gap-2">
        <Link href={localePath(lang, "/request")} className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {t.thanksAgain}
        </Link>
        <Link href={localePath(lang, "/")} className="inline-flex rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-brand-500">
          {t.thanksHome}
        </Link>
      </div>
    </div>
  );
}
