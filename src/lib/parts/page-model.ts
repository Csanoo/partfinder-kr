/**
 * 부품 상세 페이지 데이터 모델 + 메타 태그·JSON-LD 생성 (docs/SEO_SPEC.md 5.2, 5.4).
 * DB와 화면에서 분리한 순수 함수라 테스트로 검증한다.
 */

export type Lifecycle = "active" | "nrnd" | "ltb" | "eol" | "unknown";

export interface PartPageModel {
  id: string;
  mpnDisplay: string;
  manufacturer: { slug: string; nameEn: string; nameKo: string };
  category: { slug: string; nameKo: string; nameEn: string } | null;
  package: string | null;
  summaryKo: string | null;
  keySpecs: { label: string; value: string }[];
  lifecycle: {
    status: Lifecycle;
    checkedAt: Date | null;
    source: string | null;
    eolDate: Date | null;
  };
  datasheetUrl: string | null;
  alternatives: {
    mpn: string;
    manufacturerName: string | null;
    /** 게시된 내부 페이지가 있으면 경로 */
    path: string | null;
    relation: "drop_in" | "similar" | "upgrade";
    noteKo: string | null;
    verified: boolean;
  }[];
  faqs: { questionKo: string; answerKo: string }[];
  related: { mpn: string; manufacturerName: string; path: string }[];
  /** 정규 경로 (/parts/{mfr}/{slug}) */
  path: string;
  indexable: boolean;
}

export const LIFECYCLE_TEXT: Record<Lifecycle, string> = {
  active: "양산 중 (Active)",
  nrnd: "신규 설계 비권장 (NRND)",
  ltb: "최종 구매 접수 중 (LTB)",
  eol: "단종 (EOL)",
  unknown: "확인 중",
};

export const RELATION_TEXT: Record<PartPageModel["alternatives"][number]["relation"], string> = {
  drop_in: "핀 호환",
  similar: "유사 사양",
  upgrade: "상위 호환",
};

export function manufacturerLabel(m: PartPageModel["manufacturer"]): string {
  return m.nameKo && m.nameKo !== m.nameEn ? `${m.nameEn} (${m.nameKo})` : m.nameEn;
}

/** 5.2 title: `{mpn} 단종·대체품·재고 문의 | {제조사명}`, active면 `재고·구매 문의` */
export function buildTitle(p: Pick<PartPageModel, "mpnDisplay" | "manufacturer" | "lifecycle">): string {
  const phrase = p.lifecycle.status === "active" ? "재고·구매 문의" : "단종·대체품·재고 문의";
  return `${p.mpnDisplay} ${phrase} | ${p.manufacturer.nameEn}`;
}

/** 5.2 description: summary_ko에서 120자 이내. 문장 경계에서 자르고, 못 자르면 말줄임 */
export function buildDescription(summaryKo: string | null, max = 120): string {
  const s = (summaryKo ?? "").replace(/\s+/g, " ").trim();
  const chars = [...s];
  if (chars.length <= max) return s;
  const cut = chars.slice(0, max).join("");
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("다."), cut.lastIndexOf("요."));
  if (lastStop >= max * 0.5) return cut.slice(0, lastStop + (cut[lastStop] === "." ? 1 : 2)).trim();
  return `${chars.slice(0, max - 1).join("").trim()}…`;
}

export function buildRobots(indexable: boolean): { index: boolean; follow: boolean } {
  return { index: indexable, follow: true };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 5.4 JSON-LD. 화면에 보이는 내용만 넣고 offers·price·aggregateRating·review는 넣지 않는다. */
export function buildJsonLd(p: PartPageModel, siteUrl: string): Record<string, unknown>[] {
  const abs = (path: string) => new URL(path, siteUrl).toString();
  const url = abs(p.path);

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.mpnDisplay,
    mpn: p.mpnDisplay,
    brand: { "@type": "Organization", name: p.manufacturer.nameEn },
    url,
  };
  if (p.category) product.category = p.category.nameKo;
  if (p.summaryKo) product.description = p.summaryKo.trim();

  // 홈 > 카테고리 > 제조사 > 부품
  const crumbs: { name: string; item: string }[] = [{ name: "홈", item: abs("/") }];
  if (p.category) crumbs.push({ name: p.category.nameKo, item: abs(`/categories/${p.category.slug}`) });
  crumbs.push({ name: p.manufacturer.nameEn, item: abs(`/manufacturers/${p.manufacturer.slug}`) });
  crumbs.push({ name: p.mpnDisplay, item: url });
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };

  const out: Record<string, unknown>[] = [product, breadcrumb];
  if (p.faqs.length > 0) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faqs.map((f) => ({
        "@type": "Question",
        name: f.questionKo,
        acceptedAnswer: { "@type": "Answer", text: f.answerKo },
      })),
    });
  }
  return out;
}

export { ymd };
