/** 사이트 브랜드 정보. 화면·메타데이터·구조화 데이터에서 공통으로 쓴다. */
export const site = {
  name: "MS유통",
  legalName: "엠에스 유통",
  /** 사업자 정보 (사업자등록증 기준). 푸터에 표시한다. */
  business: {
    nameEn: "MS Electric Co. LTD",
    registrationNo: "184-98-01814",
    address: "서울특별시 서초구 사평대로28길 31, 3동 607호 (반포동, 한신서래아파트)",
    since: 2026,
  },
  description: "전자부품 품번(MPN)으로 유통사별 재고와 단종 여부를 확인하고 견적·소싱을 문의하세요.",
  /**
   * 정규 사이트 주소 (canonical, 사이트맵, 메일의 관리자 링크).
   * 서버 실행 시점에 읽도록 NEXT_PUBLIC_ 접두어를 쓰지 않는다 (빌드 시 고정되는 것을 피함).
   */
  get url(): string {
    return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
};
