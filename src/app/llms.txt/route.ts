import { absoluteUrl } from "@/lib/seo/part-url";
import { site } from "@/lib/site";

/** AI 답변 엔진용 사이트 안내 (llms.txt 관례). */
export function GET() {
  const body = `# ${site.name} (${site.legalName})

> ${site.description}

${site.name}은 국내 구매·개발 담당자를 위한 전자부품 품번(MPN) 검색 서비스입니다.
품번 페이지에서 정식 유통사별 재고·가격(출처와 조회 시각 포함)을 확인하고, 견적 또는 브로커 소싱을 문의할 수 있습니다.

## 페이지

- 품번 페이지: ${absoluteUrl("/part/{MPN}")} (예: ${absoluteUrl("/part/ULN2003A")})
- 검색: ${absoluteUrl("/search?q={MPN}")}

## 데이터 안내

- 가격·재고는 페이지 조회 시점의 유통사 데이터이며 출처(유통사명)와 조회 시각을 함께 표기합니다.
- 브로커 소싱은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
