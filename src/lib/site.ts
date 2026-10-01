/** 사이트 브랜드 정보. 화면·메타데이터·구조화 데이터에서 공통으로 쓴다. */
export const site = {
  name: "MS전자",
  legalName: "MinSuk 전자",
  description: "전자부품 품번(MPN)으로 유통사별 가격·재고를 비교하고 견적·소싱을 문의하세요.",
  // TODO(확인필요): 배포 도메인
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
