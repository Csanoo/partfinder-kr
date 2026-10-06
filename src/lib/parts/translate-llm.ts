import Anthropic from "@anthropic-ai/sdk";
import {
  checkTranslation,
  TRANSLATION_SCHEMA,
  translationSystemPrompt,
  translationUserPrompt,
  type TranslatableLocale,
  type TranslationOutput,
  type TranslationSource,
} from "@/lib/parts/translate";

/** 부품 번역 기능 사용 가능 여부: TRANSLATION_ENABLED=true 이고 Anthropic 자격 증명이 있을 때 */
export function translationEnabled(): boolean {
  return process.env.TRANSLATION_ENABLED === "true" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export type TranslateResult = { ok: true; output: TranslationOutput } | { ok: false; reason: string };

const MODEL = "claude-opus-5-5";

/**
 * Claude 로 부품 콘텐츠 번역 (구조화 출력).
 * - 정해진 원문을 옮기는 작업이라 effort 는 low
 * - 안전 분류기가 거절하면 서버 측 기본 대체 모델로 재시도 (fallbacks: "default")
 * - 결과는 checkTranslation 으로 검증하고, 통과하지 못하면 저장하지 않는다
 */
export async function translatePart(src: TranslationSource, locale: TranslatableLocale, client: Anthropic = new Anthropic()): Promise<TranslateResult> {
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: TRANSLATION_SCHEMA } },
      system: translationSystemPrompt(locale),
      messages: [{ role: "user", content: translationUserPrompt(src) }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "모델이 요청을 거절했습니다." };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "응답이 잘렸습니다." };

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let output: TranslationOutput;
    try {
      output = JSON.parse(text) as TranslationOutput;
    } catch {
      return { ok: false, reason: "번역 응답을 해석하지 못했습니다." };
    }
    const problems = checkTranslation(src, output);
    return problems.length === 0 ? { ok: true, output } : { ok: false, reason: problems.join(" ") };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Anthropic API 인증에 실패했습니다 (키 확인)." };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "요청 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요." };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `API 오류 ${err.status ?? ""}` };
    return { ok: false, reason: "번역 중 오류가 발생했습니다." };
  }
}
