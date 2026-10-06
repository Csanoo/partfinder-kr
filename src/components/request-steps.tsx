import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

/** 부품 요청 진행 순서 안내 (요청 페이지·홈 옆 칸) */
export function RequestSteps({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = getDictionary(locale).steps;
  return (
    <aside aria-labelledby="steps-heading" className="h-fit space-y-4 text-sm lg:sticky lg:top-20">
      <h2 id="steps-heading" className="text-base font-bold">
        {t.title}
      </h2>
      <ol className="space-y-3">
        {t.items.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span className="mpn text-sm font-bold text-brand-600 dark:text-brand-300">{i + 1}</span>
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-3 text-xs text-muted">{t.note}</p>
    </aside>
  );
}
