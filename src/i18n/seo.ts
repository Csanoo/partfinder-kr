import { LOCALE_TAG, LOCALES, localePath, type Locale } from "@/i18n/config";

/**
 * 페이지 메타의 canonical + hreflang.
 * path 는 한국어(접두어 없는) 경로. available 에는 실제로 그 언어 내용이 있는 언어만 넣는다
 * (예: 번역이 없는 부품 페이지는 해당 언어를 빼고, 그 언어 페이지는 noindex).
 */
export function alternatesFor(locale: Locale, path: string, available: readonly Locale[] = LOCALES) {
  const languages: Record<string, string> = {};
  for (const l of available) languages[LOCALE_TAG[l]] = localePath(l, path);
  languages["x-default"] = path;
  return { canonical: localePath(locale, path), languages };
}

/** Open Graph locale 형식 (ko_KR) */
export const ogLocale = (locale: Locale) => LOCALE_TAG[locale].replace("-", "_");
