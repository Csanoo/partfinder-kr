import { describe, expect, it, vi } from "vitest";
import { buildFaqCandidate, faqPublishable, FAQ_ANSWER_PLACEHOLDER, scrubPersonalInfo } from "@/lib/inquiry/to-faq";
import { buildFactSheet, buildUserPrompt, cleanDraft, findUnsupportedNumbers, SUMMARY_SYSTEM_PROMPT, type SummaryFacts } from "@/lib/parts/summary-draft";
import { generateSummaryDraft, summaryDraftEnabled } from "@/lib/parts/summary-draft-llm";

const facts: SummaryFacts = {
  mpn: "LM358-N/NOPB",
  manufacturer: "Texas Instruments",
  category: "증폭기",
  package: "SOIC-8",
  keySpecs: [
    { label: "채널 수", value: "2" },
    { label: "공급 전압", value: "3~32 V" },
  ],
  lifecycle: "eol",
  lifecycleCheckedAt: new Date("2026-10-01T00:00:00Z"),
  eolDate: new Date("2027-03-31T00:00:00Z"),
  verifiedAlternatives: [{ mpn: "LM358BIDR", relation: "drop_in" }],
};

describe("사실 목록", () => {
  it("관리자 입력 필드만 담는다", () => {
    expect(buildFactSheet(facts)).toBe(
      [
        "품번: LM358-N/NOPB",
        "제조사: Texas Instruments",
        "카테고리: 증폭기",
        "패키지: SOIC-8",
        "스펙 - 채널 수: 2",
        "스펙 - 공급 전압: 3~32 V",
        "수명주기 상태: 단종(EOL)",
        "수명주기 확인일: 2026-10-01",
        "단종(최종 주문) 시점: 2027-03-31",
        "검증된 대체품: LM358BIDR(핀 호환)",
      ].join("\n"),
    );
  });

  it("없는 필드는 줄 자체를 넣지 않는다", () => {
    const sheet = buildFactSheet({ ...facts, category: null, package: null, keySpecs: [], eolDate: null, verifiedAlternatives: [] });
    expect(sheet).not.toMatch(/카테고리|패키지|스펙|단종\(최종/);
    expect(sheet).toContain("검증된 대체품: 없음");
  });

  it("프롬프트는 사실 목록만 근거로 하라고 명시한다", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain("사실 목록에 없는 내용은 쓰지 않습니다");
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/가격/);
    expect(buildUserPrompt(facts)).toContain(buildFactSheet(facts));
  });
});

describe("지어낸 숫자 탐지", () => {
  it("사실 목록의 숫자·확인일 연월은 허용", () => {
    const draft =
      "LM358-N/NOPB는 Texas Instruments의 2채널 증폭기로 3~32 V에서 동작합니다. 2026년 10월 기준 단종(EOL) 상태이며 최종 주문은 2027년 3월 31일까지입니다.";
    expect(findUnsupportedNumbers(draft, facts)).toEqual([]);
  });

  it("목록에 없는 숫자를 잡아낸다", () => {
    expect(findUnsupportedNumbers("동작 온도는 -40~125도이며 대역폭은 1.1 MHz입니다.", facts)).toEqual(["40", "125", "1.1"]);
  });
});

describe("cleanDraft", () => {
  it("따옴표·줄바꿈 정리", () => {
    expect(cleanDraft('  "첫 문장입니다.\n\n둘째 문장입니다."  ')).toBe("첫 문장입니다. 둘째 문장입니다.");
  });
});

describe("generateSummaryDraft (Claude 호출부, 가짜 클라이언트)", () => {
  type FakeClient = Parameters<typeof generateSummaryDraft>[1];
  const fake = (response: unknown) => {
    const create = vi.fn(async () => response);
    return { client: { beta: { messages: { create } } } as unknown as FakeClient, create };
  };

  it("요청: claude-opus-5-5, effort low, 기본 fallback, 사실 목록 포함", async () => {
    const { client, create } = fake({ stop_reason: "end_turn", content: [{ type: "text", text: "요약입니다." }] });
    expect(await generateSummaryDraft(facts, client)).toEqual({ ok: true, text: "요약입니다." });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5-5",
        fallbacks: "default",
        betas: ["server-side-fallback-2026-07-01"],
        output_config: { effort: "low" },
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(facts) }],
      }),
    );
  });

  it("거절·잘림·빈 응답은 초안을 만들지 않는다", async () => {
    expect((await generateSummaryDraft(facts, fake({ stop_reason: "refusal", content: [] }).client)).ok).toBe(false);
    expect((await generateSummaryDraft(facts, fake({ stop_reason: "max_tokens", content: [{ type: "text", text: "잘" }] }).client)).ok).toBe(false);
    expect((await generateSummaryDraft(facts, fake({ stop_reason: "end_turn", content: [] }).client)).ok).toBe(false);
  });

  it("thinking 블록은 무시하고 text 만 쓴다", async () => {
    const { client } = fake({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "본문" },
      ],
    });
    expect(await generateSummaryDraft(facts, client)).toEqual({ ok: true, text: "본문" });
  });

  it("기능 플래그와 자격 증명이 모두 있어야 켜진다", () => {
    vi.stubEnv("SUMMARY_DRAFT_ENABLED", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    expect(summaryDraftEnabled()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect(summaryDraftEnabled()).toBe(true);
    vi.stubEnv("SUMMARY_DRAFT_ENABLED", "");
    expect(summaryDraftEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("문의 → FAQ 후보", () => {
  it("이메일·전화번호·URL·이름·회사명을 지운다", () => {
    const s = scrubPersonalInfo("홍길동입니다. ACME 구매팀, 010-1234-5678 / 02 123 4567 / a.b@acme.co.kr https://acme.co.kr/x 로 연락주세요", [
      "홍길동",
      "ACME",
    ]);
    expect(s).toBe("[이름]입니다. [이름] 구매팀, [연락처] / [연락처] / [이메일] [링크] 로 연락주세요");
  });

  it("+82 국제 표기 휴대폰도 지운다", () => {
    expect(scrubPersonalInfo("+82-10-1234-5678")).toBe("[연락처]");
  });

  it("메모가 있으면 정리된 메모를 질문 초안으로, 없으면 일반 질문", () => {
    const base = { mpn: "LM358", qty: 100, type: "sourcing" as const, contactName: "홍길동", company: null };
    expect(buildFaqCandidate({ ...base, memo: "홍길동입니다. 대체품도 가능한가요?" }).questionKo).toBe("[이름]입니다. 대체품도 가능한가요?");
    expect(buildFaqCandidate({ ...base, memo: null }).questionKo).toBe("LM358 를 정식 유통사 외 경로로 구할 수 있나요?");
    expect(buildFaqCandidate({ ...base, memo: null }).answerKo).toBe(FAQ_ANSWER_PLACEHOLDER);
  });

  it("답변 자리표시가 남아 있거나 너무 짧으면 게시 불가", () => {
    expect(faqPublishable(FAQ_ANSWER_PLACEHOLDER)).toBe(false);
    expect(faqPublishable("네")).toBe(false);
    expect(faqPublishable("핀 호환 대체품 LM358BIDR 이 확인되어 있습니다.")).toBe(true);
  });
});
