import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { ja } from "@/i18n/dictionaries/ja";
import { ko, type Dict } from "@/i18n/dictionaries/ko";

export type { Dict };

const DICTS: Record<Locale, Dict> = { ko, en, ja, es };

/** 언어별 화면 문구. 사전은 작아서 모두 서버 번들에 넣는다 (클라이언트에는 필요한 부분만 props 로) */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dict {
  return DICTS[locale] ?? ko;
}

/** "{n}개" 같은 자리표시 채우기 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
