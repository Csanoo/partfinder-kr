/**
 * 허브 페이지 (docs/SEO_SPEC.md 4장): 제조사 /manufacturers/{slug}, 카테고리 /categories/{slug}, 단종 목록 /eol
 * - 제조사·카테고리 허브는 게시 부품 N개(기본 5) 이상일 때만 색인
 * - /eol 은 색인
 */
import type { Lifecycle } from "@/lib/parts/page-model";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

export const HUB_PAGE_SIZE = 100;

export function hubMinParts(): number {
  const v = Number(process.env.SEO_HUB_MIN_PARTS);
  return Number.isInteger(v) && v > 0 ? v : 5;
}

export function hubIndexable(publishedCount: number, min = hubMinParts()): boolean {
  return publishedCount >= min;
}

/** /eol 에 싣는 수명주기 (단종·최종 구매·신규 설계 비권장) */
export const EOL_LIST_STATUSES: Lifecycle[] = ["eol", "ltb", "nrnd"];

export interface HubItem {
  mpn: string;
  path: string;
  manufacturerName: string;
  categoryName: string | null;
  lifecycle: Lifecycle;
  eolDate: Date | null;
}

export interface HubModel {
  kind: "manufacturer" | "category" | "eol";
  title: string;
  /** 화면 상단 설명 (관리자 입력 description_ko 또는 사실 문장) */
  intro: string;
  /** 경로 표시·구조화 데이터용 짧은 이름 */
  breadcrumbName: string;
  path: string;
  items: HubItem[];
  total: number;
  page: number;
  pageCount: number;
  indexable: boolean;
  /** 같은 허브 안 다른 축으로의 내부 링크 (제조사 허브 → 카테고리들, 카테고리 허브 → 제조사들) */
  facets: { label: string; path: string; count: number }[];
}

/** ?page= 파싱. 범위 밖이면 null (404) */
export function parsePage(raw: string | undefined, total: number, size = HUB_PAGE_SIZE): number | null {
  const pageCount = Math.max(1, Math.ceil(total / size));
  if (raw == null || raw === "") return 1;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= pageCount ? n : null;
}

/** 페이지별 정규 URL: 1페이지는 쿼리 없이, 나머지는 ?page=n */
export function pagePath(path: string, page: number): string {
  return page <= 1 ? path : `${path}?page=${page}`;
}

/** 허브 JSON-LD: BreadcrumbList + ItemList (화면에 보이는 목록과 같은 순서·이름) */
export function buildHubJsonLd(hub: HubModel, siteUrl: string, breadcrumbName: string, locale: Locale = "ko"): Record<string, unknown>[] {
  const abs = (p: string) => new URL(localePath(locale, p), siteUrl).toString();
  const home = getDictionary(locale).common.home;
  const offset = (hub.page - 1) * HUB_PAGE_SIZE;
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: home, item: abs("/") },
        { "@type": "ListItem", position: 2, name: breadcrumbName, item: abs(pagePath(hub.path, hub.page)) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: hub.title,
      numberOfItems: hub.total,
      itemListElement: hub.items.map((it, i) => ({
        "@type": "ListItem",
        position: offset + i + 1,
        name: it.mpn,
        url: abs(it.path),
      })),
    },
  ];
}
