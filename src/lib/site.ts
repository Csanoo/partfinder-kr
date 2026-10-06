/** 사이트 브랜드 정보. 화면·메타데이터·구조화 데이터에서 공통으로 쓴다. */
export const site = {
  name: "MS유통",
  /** 한국어 외 화면에서 쓰는 이름 (상호 영문 표기 기준) */
  nameIntl: "MS Electric",
  legalName: "엠에스 유통",
  /** 사업자 정보 (사업자등록증 기준). 푸터에 표시한다. */
  business: {
    nameEn: "MS Electric Co. LTD",
    registrationNo: "184-98-01814",
    since: 2026,
  },
  /** 운영 주체 고지 (SEO_SPEC 제약 6). 모든 페이지 공통 푸터에 표시한다. */
  operatorNotice: "본 사이트는 독립 운영되며, 소싱 문의는 협력 업체를 통해 처리됩니다. 제조사·정식 유통사와 무관합니다.",
  description: "필요한 전자부품을 찾아서 공급합니다. 품번과 수량만 알려주시면 정식 유통 재고부터 단종·품귀 부품까지 공급처를 찾아 회신드립니다.",
  /**
   * 정규 사이트 주소 (canonical, 사이트맵, 메일의 관리자 링크).
   * 서버 실행 시점에 읽도록 NEXT_PUBLIC_ 접두어를 쓰지 않는다 (빌드 시 고정되는 것을 피함).
   */
  get url(): string {
    return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
};

/** 화면 언어별 사이트 이름: 한국어는 MS유통, 그 외는 MS Electric */
export function siteName(locale: string = "ko"): string {
  return locale === "ko" ? site.name : site.nameIntl;
}
