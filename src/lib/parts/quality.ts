/**
 * 색인 품질 기준 (docs/SEO_SPEC.md 5.3).
 * 기준 값은 환경변수로 조정한다. 관리자 화면 체크리스트와 indexable 계산이 같은 함수를 쓴다.
 */

export interface QualityConfig {
  /** summary_ko 최소 글자 수 */
  minSummaryLength: number;
  /** lifecycle_checked_at 허용 경과 개월 수 */
  lifecycleMaxAgeMonths: number;
  /** "주요 스펙 충분" 판정 최소 개수 */
  minKeySpecs: number;
  /** 보조 신호(스펙·대체품·FAQ·EOL일) 중 최소 충족 개수 */
  minOptionalSignals: number;
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minSummaryLength: 80,
  lifecycleMaxAgeMonths: 12,
  minKeySpecs: 3,
  minOptionalSignals: 2,
};

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v >= 0 ? v : fallback;
}

export function qualityConfig(): QualityConfig {
  return {
    minSummaryLength: intEnv("SEO_MIN_SUMMARY_LENGTH", DEFAULT_QUALITY_CONFIG.minSummaryLength),
    lifecycleMaxAgeMonths: intEnv("SEO_LIFECYCLE_MAX_AGE_MONTHS", DEFAULT_QUALITY_CONFIG.lifecycleMaxAgeMonths),
    minKeySpecs: intEnv("SEO_MIN_KEY_SPECS", DEFAULT_QUALITY_CONFIG.minKeySpecs),
    minOptionalSignals: intEnv("SEO_MIN_OPTIONAL_SIGNALS", DEFAULT_QUALITY_CONFIG.minOptionalSignals),
  };
}

export interface QualityInput {
  pageStatus: "draft" | "review" | "published" | "unpublished";
  reviewedBy: string | null;
  summaryKo: string | null;
  lifecycleStatus: "active" | "nrnd" | "ltb" | "eol" | "unknown";
  lifecycleCheckedAt: Date | null;
  eolDate: Date | null;
  keySpecs: { label: string; value: string }[];
  verifiedAlternativeCount: number;
  publishedFaqCount: number;
}

export type CheckId =
  | "published"
  | "reviewed"
  | "summary"
  | "lifecycle_known"
  | "lifecycle_fresh"
  | "optional_signals";

export interface QualityCheck {
  id: CheckId;
  label: string;
  ok: boolean;
  detail: string;
}

export interface QualityResult {
  indexable: boolean;
  checks: QualityCheck[];
  /** 보조 신호 충족 내역 */
  signals: { keySpecs: boolean; verifiedAlternative: boolean; publishedFaq: boolean; eolDate: boolean };
}

/** 사람이 읽는 글자 수 (서로게이트 쌍·결합 문자를 한 글자로) */
export function charCount(s: string): number {
  return [...s.normalize("NFC")].length;
}

/** now 기준 months 개월 전 같은 시각 (말일 보정) */
export function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function evaluateQuality(
  input: QualityInput,
  now: Date = new Date(),
  config: QualityConfig = qualityConfig(),
): QualityResult {
  const summaryLen = input.summaryKo ? charCount(input.summaryKo.trim()) : 0;
  const validSpecs = input.keySpecs.filter((s) => s.label.trim() !== "" && s.value.trim() !== "");
  const oldest = monthsAgo(now, config.lifecycleMaxAgeMonths);
  const checkedAt = input.lifecycleCheckedAt;
  // 12개월 "이내": 정확히 12개월 전 시각까지 포함. 미래 날짜는 입력 오류로 본다.
  const fresh = checkedAt != null && checkedAt.getTime() >= oldest.getTime() && checkedAt.getTime() <= now.getTime();

  const signals = {
    keySpecs: validSpecs.length >= config.minKeySpecs,
    verifiedAlternative: input.verifiedAlternativeCount >= 1,
    publishedFaq: input.publishedFaqCount >= 1,
    eolDate: input.eolDate != null,
  };
  const signalCount = Object.values(signals).filter(Boolean).length;

  const checks: QualityCheck[] = [
    {
      id: "published",
      label: "게시 상태",
      ok: input.pageStatus === "published",
      detail: input.pageStatus === "published" ? "게시됨" : `현재 ${input.pageStatus}`,
    },
    {
      id: "reviewed",
      label: "검토자 기록",
      ok: !!input.reviewedBy?.trim(),
      detail: input.reviewedBy?.trim() ? `검토: ${input.reviewedBy}` : "검토 완료 처리 필요",
    },
    {
      id: "summary",
      label: `요약 ${config.minSummaryLength}자 이상`,
      ok: summaryLen >= config.minSummaryLength,
      detail: `${summaryLen}자`,
    },
    {
      id: "lifecycle_known",
      label: "수명주기 상태 확인",
      ok: input.lifecycleStatus !== "unknown",
      detail: input.lifecycleStatus,
    },
    {
      id: "lifecycle_fresh",
      label: `수명주기 확인일 ${config.lifecycleMaxAgeMonths}개월 이내`,
      ok: fresh,
      detail:
        checkedAt == null
          ? "확인일 없음"
          : checkedAt.getTime() > now.getTime()
            ? "미래 날짜 (입력 확인)"
            : `${checkedAt.toISOString().slice(0, 10)} 확인`,
    },
    {
      id: "optional_signals",
      label: `보조 정보 ${config.minOptionalSignals}개 이상`,
      ok: signalCount >= config.minOptionalSignals,
      detail: [
        `스펙 ${validSpecs.length}/${config.minKeySpecs}`,
        `검증 대체품 ${input.verifiedAlternativeCount}`,
        `게시 FAQ ${input.publishedFaqCount}`,
        `EOL일 ${input.eolDate ? "있음" : "없음"}`,
      ].join(" · "),
    },
  ];

  return { indexable: checks.every((c) => c.ok), checks, signals };
}
