/**
 * 다국어 설정. 한국어가 기본이며 주소에 접두어가 없다 (/request).
 * 다른 언어는 접두어를 붙인다 (/en/request, /ja/request, /es/request).
 * 내부적으로는 모든 공개 페이지가 app/[lang] 아래에 있고, proxy 가 접두어 없는 주소를 /ko 로 rewrite 한다.
 */
export const LOCALES = ["ko", "en", "ja", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export const hasLocale = (v: string | null | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** 언어 선택 메뉴에 보이는 이름 (각 언어로 표기) */
export const LOCALE_LABEL: Record<Locale, string> = { ko: "한국어", en: "English", ja: "日本語", es: "Español" };

/** Open Graph·숫자/날짜 형식용 지역 코드 */
export const LOCALE_TAG: Record<Locale, string> = { ko: "ko-KR", en: "en-US", ja: "ja-JP", es: "es-ES" };

/** 경로에 언어 접두어를 붙인다. path 는 "/" 로 시작하는 한국어(기본) 경로 */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** 주소에서 언어 접두어를 떼어 낸다: /en/request → { locale: "en", path: "/request" } */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (m && hasLocale(m[1]) && m[1] !== DEFAULT_LOCALE) return { locale: m[1], path: m[2] || "/" };
  return { locale: DEFAULT_LOCALE, path: pathname };
}
