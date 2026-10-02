/**
 * 요약 초안 생성 (docs/SEO_SPEC.md 7장, 선택 기능).
 * 관리자가 입력한 사실 필드만 근거로 LLM 이 summary_ko 초안을 쓴다.
 * 초안은 별도 칸(summary_draft_ko)에만 저장되고, 관리자가 검토·적용해야 화면에 쓰인다.
 */

export interface SummaryFacts {
  mpn: string;
  manufacturer: string;
  category: string | null;
  package: string | null;
  keySpecs: { label: string; value: string }[];
  lifecycle: "active" | "nrnd" | "ltb" | "eol" | "unknown";
  lifecycleCheckedAt: Date | null;
  eolDate: Date | null;
  /** 검증된 대체품만 */
  verifiedAlternatives: { mpn: string; relation: "drop_in" | "similar" | "upgrade" }[];
}

const LIFECYCLE_KO: Record<SummaryFacts["lifecycle"], string> = {
  active: "양산 중(Active)",
  nrnd: "신규 설계 비권장(NRND)",
  ltb: "최종 구매 접수 중(LTB)",
  eol: "단종(EOL)",
  unknown: "확인되지 않음",
};
const RELATION_KO = { drop_in: "핀 호환", similar: "유사 사양", upgrade: "상위 호환" } as const;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 사실 목록 (LLM 입력이자, 초안 검증 기준) */
export function buildFactSheet(f: SummaryFacts): string {
  const lines = [
    `품번: ${f.mpn}`,
    `제조사: ${f.manufacturer}`,
    f.category ? `카테고리: ${f.category}` : null,
    f.package ? `패키지: ${f.package}` : null,
    ...f.keySpecs.map((s) => `스펙 - ${s.label}: ${s.value}`),
    `수명주기 상태: ${LIFECYCLE_KO[f.lifecycle]}`,
    f.lifecycleCheckedAt ? `수명주기 확인일: ${ymd(f.lifecycleCheckedAt)}` : null,
    f.eolDate ? `단종(최종 주문) 시점: ${ymd(f.eolDate)}` : null,
    f.verifiedAlternatives.length > 0
      ? `검증된 대체품: ${f.verifiedAlternatives.map((a) => `${a.mpn}(${RELATION_KO[a.relation]})`).join(", ")}`
      : "검증된 대체품: 없음",
  ];
  return lines.filter((l): l is string => l != null).join("\n");
}

export const SUMMARY_SYSTEM_PROMPT = `당신은 전자부품 정보 사이트의 편집자입니다. 주어진 "사실 목록"만 근거로 부품 페이지 첫 문단에 들어갈 한국어 요약을 씁니다.
이 문단은 검색엔진과 AI 답변 엔진이 그대로 인용할 수 있어야 하므로, 사실 문장으로 결론부터 씁니다.

규칙:
- 사실 목록에 없는 내용은 쓰지 않습니다. 용도, 성능 우위, 인기, 재고, 가격, 납기처럼 목록에 없는 주장은 넣지 않습니다. 모르면 생략합니다.
- 숫자·날짜·품번은 사실 목록에 적힌 그대로 옮깁니다.
- 2~3문장, 공백 포함 90~200자.
- 첫 문장: 무엇인지 (제조사, 카테고리, 핵심 스펙 1~2개).
- 이어서: 수명주기 상태를 확인일 기준으로 ("2026년 10월 기준 단종(EOL) 상태입니다"처럼 연·월로). 대체품이 있으면 개수와 관계를 언급합니다.
- 광고 문구, 느낌표, 이모지, 마크다운, 따옴표로 감싸기는 쓰지 않습니다.
- 요약 문단 본문만 출력합니다. 머리말이나 설명을 붙이지 않습니다.`;

export function buildUserPrompt(f: SummaryFacts): string {
  return `사실 목록:\n${buildFactSheet(f)}\n\n위 사실만으로 요약 문단을 써 주세요.`;
}

/**
 * 초안에 사실 목록에 없는 숫자가 있는지 검사 (지어낸 사실 탐지용 보조 장치).
 * 연·월 표기("2026년 10월")는 확인일·단종일에서 나온 것이면 허용한다.
 */
export function findUnsupportedNumbers(draft: string, f: SummaryFacts): string[] {
  const sheet = buildFactSheet(f);
  const allowed = new Set<string>();
  for (const m of sheet.matchAll(/\d+(?:\.\d+)?/g)) allowed.add(m[0]);
  for (const d of [f.lifecycleCheckedAt, f.eolDate]) {
    if (!d) continue;
    allowed.add(String(d.getUTCFullYear()));
    allowed.add(String(d.getUTCMonth() + 1));
    allowed.add(String(d.getUTCDate()));
  }
  allowed.add(String(f.verifiedAlternatives.length));
  // 대체품 개수를 한글 수사로 쓰는 경우는 숫자가 아니라 검사 대상이 아님
  const found = [...draft.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
  return [...new Set(found.filter((n) => !allowed.has(n) && !allowed.has(String(Number(n)))))];
}

export function cleanDraft(text: string): string {
  return text
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}
