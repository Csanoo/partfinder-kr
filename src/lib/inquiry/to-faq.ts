/**
 * 문의 → FAQ 후보 (docs/SEO_SPEC.md 7장).
 * 개인정보(이메일·전화번호·담당자명·회사명·URL)를 지운 질문 초안을 만들고, 답변은 관리자가 쓴다.
 * 후보는 항상 미게시로 만들어지며, 답변 자리표시가 남아 있으면 게시할 수 없다.
 */

export const FAQ_ANSWER_PLACEHOLDER = "(답변 작성 필요)";

export function scrubPersonalInfo(text: string, names: (string | null | undefined)[] = []): string {
  let s = text;
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[이메일]");
  s = s.replace(/https?:\/\/\S+/g, "[링크]");
  // 국내 전화번호 (휴대폰·유선, 하이픈·공백·점 구분, +82 포함)
  s = s.replace(/(\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, "[연락처]");
  s = s.replace(/\b0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}\b/g, "[연락처]");
  for (const n of names) {
    const name = n?.trim();
    if (name && name.length >= 2) s = s.split(name).join("[이름]");
  }
  return s.replace(/\s+/g, " ").trim();
}

export interface InquiryForFaq {
  mpn: string;
  qty: number;
  type: "quote" | "sourcing" | "request";
  memo: string | null;
  contactName: string | null;
  company: string | null;
}

/** 질문 초안: 메모가 있으면 개인정보를 지운 메모, 없으면 문의 종류로 만든 일반 질문 */
export function buildFaqCandidate(q: InquiryForFaq): { questionKo: string; answerKo: string } {
  const memo = q.memo ? scrubPersonalInfo(q.memo, [q.contactName, q.company]).slice(0, 300) : "";
  const fallback =
    q.type === "sourcing" ? `${q.mpn} 를 정식 유통사 외 경로로 구할 수 있나요?` : q.type === "request" ? `${q.mpn} 를 구할 수 있나요?` : `${q.mpn} 견적은 어떻게 받나요?`;
  return { questionKo: memo.length >= 5 ? memo : fallback, answerKo: FAQ_ANSWER_PLACEHOLDER };
}

/** 게시 가능 여부: 자리표시 답변·빈 답변은 게시 불가 */
export function faqPublishable(answerKo: string): boolean {
  const a = answerKo.trim();
  return a.length >= 5 && !a.includes(FAQ_ANSWER_PLACEHOLDER);
}
