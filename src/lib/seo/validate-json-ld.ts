/**
 * JSON-LD 검증 (schema.org 구조 + 구글 리치 결과 필수 속성 + 이 사이트의 금지 규칙).
 * 외부 검증 도구 없이 테스트에서 돌릴 수 있는 범위만 확인한다.
 */

const ALLOWED_TYPES = new Set(["Product", "BreadcrumbList", "FAQPage", "Organization", "WebSite", "ItemList"]);
/** SEO_SPEC 제약 4·5.4: 가격·평점·리뷰 금지 */
const FORBIDDEN_KEYS = new Set(["offers", "price", "priceCurrency", "lowPrice", "highPrice", "aggregateRating", "review"]);

type Node = Record<string, unknown>;

const isObj = (v: unknown): v is Node => typeof v === "object" && v != null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isAbsUrl = (v: unknown) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

function findForbidden(v: unknown, path: string, errors: string[]) {
  if (Array.isArray(v)) v.forEach((x, i) => findForbidden(x, `${path}[${i}]`, errors));
  else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k)) errors.push(`${path}.${k}: 금지된 속성`);
      findForbidden(x, `${path}.${k}`, errors);
    }
  }
}

export function validateJsonLd(nodes: unknown[]): string[] {
  const errors: string[] = [];
  nodes.forEach((node, i) => {
    const at = `[${i}]`;
    if (!isObj(node)) return errors.push(`${at}: 객체가 아님`);
    if (node["@context"] !== "https://schema.org") errors.push(`${at}: @context 가 https://schema.org 가 아님`);
    const type = node["@type"];
    if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) return errors.push(`${at}: 허용되지 않은 @type ${String(type)}`);
    findForbidden(node, at, errors);

    if (type === "Product") {
      if (!nonEmpty(node.name)) errors.push(`${at} Product.name 필수`);
      if (node.url !== undefined && !isAbsUrl(node.url)) errors.push(`${at} Product.url 은 절대 URL`);
      if (node.brand !== undefined && !(isObj(node.brand) && nonEmpty(node.brand.name) && nonEmpty(node.brand["@type"]))) {
        errors.push(`${at} Product.brand 는 @type·name 을 가진 객체`);
      }
    }

    if (type === "BreadcrumbList") {
      const items = node.itemListElement;
      if (!Array.isArray(items) || items.length === 0) errors.push(`${at} BreadcrumbList.itemListElement 필수`);
      else
        items.forEach((it, j) => {
          if (!isObj(it) || it["@type"] !== "ListItem") return errors.push(`${at} item[${j}] ListItem 아님`);
          if (it.position !== j + 1) errors.push(`${at} item[${j}] position 은 ${j + 1}`);
          if (!nonEmpty(it.name)) errors.push(`${at} item[${j}] name 필수`);
          if (!isAbsUrl(it.item)) errors.push(`${at} item[${j}] item 은 절대 URL`);
        });
    }

    if (type === "ItemList") {
      if (!nonEmpty(node.name)) errors.push(`${at} ItemList.name 필수`);
      const items = node.itemListElement;
      if (!Array.isArray(items)) errors.push(`${at} ItemList.itemListElement 필수`);
      else {
        let prev = 0;
        items.forEach((it, j) => {
          if (!isObj(it) || it["@type"] !== "ListItem") return errors.push(`${at} item[${j}] ListItem 아님`);
          if (typeof it.position !== "number" || it.position <= prev) errors.push(`${at} item[${j}] position 은 증가해야 함`);
          prev = typeof it.position === "number" ? it.position : prev;
          if (!nonEmpty(it.name)) errors.push(`${at} item[${j}] name 필수`);
          if (!isAbsUrl(it.url)) errors.push(`${at} item[${j}] url 은 절대 URL`);
        });
      }
    }

    if (type === "FAQPage") {
      const qs = node.mainEntity;
      if (!Array.isArray(qs) || qs.length === 0) errors.push(`${at} FAQPage.mainEntity 필수 (FAQ 없으면 FAQPage 를 넣지 않는다)`);
      else
        qs.forEach((q, j) => {
          if (!isObj(q) || q["@type"] !== "Question" || !nonEmpty(q.name)) return errors.push(`${at} Q[${j}] Question.name 필수`);
          const a = q.acceptedAnswer;
          if (!isObj(a) || a["@type"] !== "Answer" || !nonEmpty(a.text)) errors.push(`${at} Q[${j}] acceptedAnswer.text 필수`);
        });
    }
  });
  return errors;
}

/** JSON-LD 안의 사람에게 보이는 텍스트 값 (URL·@ 키 제외) — 화면 노출 여부 검사용 */
export function visibleTextValues(nodes: unknown[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, k);
    else if (typeof v === "string" && !key.startsWith("@") && !["url", "item"].includes(key) && !isAbsUrl(v)) out.push(v);
  };
  walk(nodes, "");
  return out;
}
