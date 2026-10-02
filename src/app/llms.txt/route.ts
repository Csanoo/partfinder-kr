import { absoluteUrl } from "@/lib/seo/part-url";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** AI 답변 엔진용 사이트 안내 (llms.txt 관례). */
export function GET() {
  const body = `# ${site.name} (${site.legalName})

> ${site.description}

${site.name}은 국내 구매·개발 담당자를 위한 전자부품 품번(MPN) 검색 서비스입니다.
정식 유통사 재고(출처와 조회 시각 포함)를 확인하고, 견적 또는 브로커 소싱을 문의할 수 있습니다.

## 페이지

- 홈: ${absoluteUrl("/")}

## 데이터 안내

- 재고 정보는 조회 시점의 유통사 데이터이며 출처(유통사명)와 조회 시각을 함께 표기합니다. 가격은 표시하지 않습니다.
- 브로커 소싱은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
