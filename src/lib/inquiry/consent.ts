import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

/**
 * 동의 문구. 환경변수로 바꿀 수 있고, 문의에는 동의 당시 버전(CONSENT_TEXT_VERSION)을 저장한다.
 * 문구를 바꾸면 반드시 버전도 올린다.
 */

const DEFAULT_PRIVACY = `[개인정보 수집·이용 동의]
- 수집 항목: 담당자명, 연락처, 이메일, 회사명
- 이용 목적: 부품 요청·견적·소싱 문의 회신
- 보유 기간: TODO(확인필요)`;

// TODO(확인필요): 제공받는 자·목적·보유기간 (소싱 문의 전달 대상)
const DEFAULT_THIRD_PARTY = `[개인정보 제3자 제공 동의]
- 제공받는 자: TODO(확인필요)
- 제공 목적: TODO(확인필요)
- 제공 항목: 담당자명, 연락처, 이메일, 회사명, 문의 내용
- 보유 기간: TODO(확인필요)`;

export function consentTexts() {
  return {
    version: process.env.CONSENT_TEXT_VERSION ?? "2026-10-06-draft",
    privacy: process.env.CONSENT_PRIVACY_TEXT ?? DEFAULT_PRIVACY,
    thirdParty: process.env.CONSENT_THIRD_PARTY_TEXT ?? DEFAULT_THIRD_PARTY,
  };
}

/** 화면 언어별 동의 문구. 한국어는 환경변수 덮어쓰기를 따르고, 다른 언어는 사전 문구 (버전은 같이 쓴다) */
export function consentFor(locale: Locale) {
  const base = consentTexts();
  if (locale === "ko") return base;
  const t = getDictionary(locale).consent;
  return { version: base.version, privacy: t.privacy, thirdParty: t.thirdParty };
}
