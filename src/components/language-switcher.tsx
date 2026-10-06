import { headers } from "next/headers";
import { LOCALE_LABEL, LOCALES, localePath, type Locale } from "@/i18n/config";
import { PATH_HEADER } from "@/i18n/headers";

/**
 * 언어 선택 (헤더). 지금 보고 있는 페이지의 다른 언어 주소로 보낸다.
 * 경로는 proxy 가 요청 헤더에 넣어 준 "언어 접두어를 뗀 경로 + 쿼리" 를 쓴다 (JS 없이 동작).
 */
export async function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const path = (await headers()).get(PATH_HEADER) || "/";
  return (
    <details className="group relative">
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        <span className="uppercase">{locale}</span>
      </summary>
      <ul className="absolute right-0 z-30 mt-1 w-36 rounded-md border border-line bg-surface py-1 shadow-sm">
        {LOCALES.map((l) => (
          <li key={l}>
            <a
              href={localePath(l, path)}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              className={`block px-3 py-1.5 text-sm hover:bg-background ${l === locale ? "font-semibold text-brand-700 dark:text-brand-200" : ""}`}
            >
              {LOCALE_LABEL[l]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
