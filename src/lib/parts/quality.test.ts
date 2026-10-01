import { afterEach, describe, expect, it, vi } from "vitest";
import { charCount, DEFAULT_QUALITY_CONFIG, evaluateQuality, monthsAgo, qualityConfig, type QualityInput } from "@/lib/parts/quality";

const NOW = new Date("2026-10-01T03:00:00.000Z");
const summary = (n: number) => "가".repeat(n);
const specs = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `스펙${i}`, value: `${i}` }));

/** 모든 기준을 딱 맞게 통과하는 입력 (보조 신호는 정확히 2개) */
function passing(over: Partial<QualityInput> = {}): QualityInput {
  return {
    pageStatus: "published",
    reviewedBy: "admin",
    summaryKo: summary(80),
    lifecycleStatus: "eol",
    lifecycleCheckedAt: new Date("2026-09-01T00:00:00.000Z"),
    eolDate: new Date("2026-12-31T00:00:00.000Z"),
    keySpecs: specs(3),
    verifiedAlternativeCount: 0,
    publishedFaqCount: 0,
    ...over,
  };
}

const evaluate = (over: Partial<QualityInput> = {}) => evaluateQuality(passing(over), NOW, DEFAULT_QUALITY_CONFIG);
const failed = (over: Partial<QualityInput>) => evaluate(over).checks.filter((c) => !c.ok).map((c) => c.id);

afterEach(() => vi.unstubAllEnvs());

describe("evaluateQuality: 기준선", () => {
  it("모든 기준을 딱 맞게 충족하면 indexable", () => {
    const r = evaluate();
    expect(r.indexable).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
});

describe("게시 상태·검토자", () => {
  it.each(["draft", "review", "unpublished"] as const)("page_status=%s 이면 색인 불가", (pageStatus) => {
    expect(failed({ pageStatus })).toEqual(["published"]);
  });

  it.each([null, "", "   "])("reviewed_by=%j 이면 색인 불가", (reviewedBy) => {
    expect(failed({ reviewedBy })).toEqual(["reviewed"]);
  });
});

describe("summary_ko 80자 경계", () => {
  it("80자 통과, 79자 실패", () => {
    expect(evaluate({ summaryKo: summary(80) }).indexable).toBe(true);
    expect(failed({ summaryKo: summary(79) })).toEqual(["summary"]);
  });

  it("앞뒤 공백은 세지 않는다", () => {
    expect(failed({ summaryKo: `   ${summary(79)}   ` })).toEqual(["summary"]);
  });

  it("null 은 0자", () => {
    expect(failed({ summaryKo: null })).toEqual(["summary"]);
  });

  it("이모지·결합 문자는 한 글자로 센다", () => {
    expect(charCount("👍")).toBe(1);
    expect(charCount("한글")).toBe(2);
    expect(charCount("한")).toBe(1); // 자모 조합 '한' (NFC 정규화)
  });
});

describe("수명주기", () => {
  it("unknown 이면 색인 불가", () => {
    expect(failed({ lifecycleStatus: "unknown" })).toEqual(["lifecycle_known"]);
  });

  it.each(["active", "nrnd", "ltb", "eol"] as const)("%s 는 통과", (lifecycleStatus) => {
    expect(evaluate({ lifecycleStatus }).checks.find((c) => c.id === "lifecycle_known")!.ok).toBe(true);
  });

  it("확인일 정확히 12개월 전은 통과, 1ms 더 지나면 실패", () => {
    const boundary = new Date("2025-10-01T03:00:00.000Z");
    expect(evaluate({ lifecycleCheckedAt: boundary }).indexable).toBe(true);
    expect(failed({ lifecycleCheckedAt: new Date(boundary.getTime() - 1) })).toEqual(["lifecycle_fresh"]);
  });

  it("확인일 없음은 실패", () => {
    expect(failed({ lifecycleCheckedAt: null })).toEqual(["lifecycle_fresh"]);
  });

  it("미래 확인일은 입력 오류로 실패", () => {
    const r = evaluate({ lifecycleCheckedAt: new Date(NOW.getTime() + 60_000) });
    expect(r.indexable).toBe(false);
    expect(r.checks.find((c) => c.id === "lifecycle_fresh")!.detail).toContain("미래");
  });

  it("월말 보정: 3월 31일 기준 1개월 전은 2월 말일", () => {
    expect(monthsAgo(new Date("2026-03-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(monthsAgo(new Date("2028-03-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z"); // 윤년
  });
});

describe("보조 정보 2개 이상 (스펙 3개 / 검증 대체품 / 게시 FAQ / EOL일)", () => {
  const none = { keySpecs: specs(0), verifiedAlternativeCount: 0, publishedFaqCount: 0, eolDate: null };

  it("0개·1개는 실패", () => {
    expect(failed(none)).toEqual(["optional_signals"]);
    expect(failed({ ...none, eolDate: new Date("2027-01-01") })).toEqual(["optional_signals"]);
  });

  it.each([
    ["스펙 + 대체품", { keySpecs: specs(3), verifiedAlternativeCount: 1 }],
    ["스펙 + FAQ", { keySpecs: specs(3), publishedFaqCount: 1 }],
    ["스펙 + EOL일", { keySpecs: specs(3), eolDate: new Date("2027-01-01") }],
    ["대체품 + FAQ", { verifiedAlternativeCount: 1, publishedFaqCount: 1 }],
    ["대체품 + EOL일", { verifiedAlternativeCount: 1, eolDate: new Date("2027-01-01") }],
    ["FAQ + EOL일", { publishedFaqCount: 1, eolDate: new Date("2027-01-01") }],
  ])("2개 조합 통과: %s", (_label, over) => {
    expect(evaluate({ ...none, ...over }).indexable).toBe(true);
  });

  it("스펙은 3개부터 인정 (2개는 신호 아님)", () => {
    expect(failed({ ...none, keySpecs: specs(2), eolDate: new Date("2027-01-01") })).toEqual(["optional_signals"]);
    expect(evaluate({ ...none, keySpecs: specs(3), eolDate: new Date("2027-01-01") }).indexable).toBe(true);
  });

  it("빈 라벨·값의 스펙은 세지 않는다", () => {
    const keySpecs = [...specs(2), { label: "", value: "x" }, { label: "y", value: " " }];
    expect(evaluate({ ...none, keySpecs, eolDate: new Date("2027-01-01") }).signals.keySpecs).toBe(false);
  });
});

describe("여러 기준 동시 미충족", () => {
  it("미충족 항목을 모두 체크리스트에 표시한다", () => {
    expect(failed({ pageStatus: "draft", reviewedBy: null, summaryKo: null, lifecycleStatus: "unknown" })).toEqual([
      "published",
      "reviewed",
      "summary",
      "lifecycle_known",
    ]);
  });
});

describe("기준 값 환경설정", () => {
  it("환경변수로 조정한다", () => {
    vi.stubEnv("SEO_MIN_SUMMARY_LENGTH", "120");
    vi.stubEnv("SEO_LIFECYCLE_MAX_AGE_MONTHS", "6");
    vi.stubEnv("SEO_MIN_KEY_SPECS", "5");
    vi.stubEnv("SEO_MIN_OPTIONAL_SIGNALS", "3");
    expect(qualityConfig()).toEqual({ minSummaryLength: 120, lifecycleMaxAgeMonths: 6, minKeySpecs: 5, minOptionalSignals: 3 });
  });

  it("잘못된 값은 기본값", () => {
    vi.stubEnv("SEO_MIN_SUMMARY_LENGTH", "abc");
    vi.stubEnv("SEO_LIFECYCLE_MAX_AGE_MONTHS", "-1");
    expect(qualityConfig().minSummaryLength).toBe(80);
    expect(qualityConfig().lifecycleMaxAgeMonths).toBe(12);
  });

  it("조정된 기준으로 판정한다", () => {
    const cfg = { ...DEFAULT_QUALITY_CONFIG, minSummaryLength: 100 };
    expect(evaluateQuality(passing({ summaryKo: summary(99) }), NOW, cfg).indexable).toBe(false);
    expect(evaluateQuality(passing({ summaryKo: summary(100) }), NOW, cfg).indexable).toBe(true);
  });
});
