import Anthropic from "@anthropic-ai/sdk";
import { buildUserPrompt, cleanDraft, SUMMARY_SYSTEM_PROMPT, type SummaryFacts } from "@/lib/parts/summary-draft";

/** 요약 초안 기능 사용 가능 여부: SUMMARY_DRAFT_ENABLED=true 이고 Anthropic 자격 증명이 있을 때 */
export function summaryDraftEnabled(): boolean {
  return process.env.SUMMARY_DRAFT_ENABLED === "true" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export type DraftResult = { ok: true; text: string } | { ok: false; reason: string };

const MODEL = "claude-opus-5-5";

/**
 * Claude 로 요약 초안 생성.
 * - 짧은 정리 작업이라 effort 는 low
 * - 안전 분류기가 거절하면 서버 측 기본 대체 모델로 재시도 (fallbacks: "default")
 */
export async function generateSummaryDraft(facts: SummaryFacts, client: Anthropic = new Anthropic()): Promise<DraftResult> {
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(facts) }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "모델이 요청을 거절했습니다." };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "응답이 잘렸습니다. 다시 시도해 주세요." };

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const draft = cleanDraft(text);
    return draft ? { ok: true, text: draft } : { ok: false, reason: "빈 응답입니다." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Anthropic API 인증에 실패했습니다 (키 확인)." };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "요청 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요." };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `API 오류 ${err.status ?? ""}` };
    return { ok: false, reason: "요약 초안 생성 중 오류가 발생했습니다." };
  }
}
