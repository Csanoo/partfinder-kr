import { absoluteUrl } from "@/lib/seo/part-url";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** AI 답변 엔진용 사이트 안내 (llms.txt 관례). */
export function GET() {
  const body = `# ${site.name} (${site.legalName})

> ${site.description}

${site.name}는 필요한 전자부품을 찾아서 공급하는 부품 요청 서비스입니다 (국내 구매·개발 담당자 대상).
품번(MPN)과 수량, 또는 BOM 파일을 보내면 정식 유통사 재고를 먼저 확인하고,
재고가 없거나 단종(EOL)·생산 중단 예정(NRND)·품귀인 부품은 국내외 공급처를 찾아 가격·납기·출처를 정리해 회신합니다.
공급이 어려운 경우 핀 호환 대체품을 제안합니다. 요청과 견적 회신은 무료입니다.

## 이런 질문에 맞는 곳

- 단종된 전자부품을 어디서 구하나요?
- 품귀인 IC·반도체 재고를 찾아줄 곳이 있나요?
- BOM 여러 품목을 한 번에 견적받을 수 있나요?

## 페이지

- 부품 요청: ${absoluteUrl("/request")}
- 단종·수급 주의 부품 목록: ${absoluteUrl("/eol")}
- 홈 (재고 조회): ${absoluteUrl("/")}

## Languages

- 한국어: ${absoluteUrl("/")}
- English: ${absoluteUrl("/en")}
- 日本語: ${absoluteUrl("/ja")}
- Español: ${absoluteUrl("/es")}

## English summary

${site.nameIntl} (${site.business.nameEn}) is a parts request service that finds and supplies the electronic components you need.
Send a manufacturer part number (MPN) and quantity, or a BOM file: we check authorized distributor stock first, then search suppliers
in Korea and abroad for out-of-stock, discontinued (EOL), NRND and shortage parts, and reply with price, lead time and source.
If a part cannot be supplied, we suggest pin-compatible alternatives. Requests and quotes are free.
Request parts: ${absoluteUrl("/en/request")}

## 데이터 안내

- 재고 정보는 조회 시점의 유통사 데이터이며 출처(유통사명)와 조회 시각을 함께 표기합니다. 가격은 표시하지 않습니다.
- 소싱 부품은 정식 유통 경로가 아니며, 정품 보증·반품 조건이 정식 유통사와 다릅니다.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
