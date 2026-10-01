/**
 * robots.txt 규칙 (docs/SEO_SPEC.md 6.2)
 * - 모든 크롤러: /admin, /search, /api 차단
 * - AI 크롤러: 검색·답변용 허용, 학습용 차단 (결정 2026-10-01). 목록은 환경변수로 덮어쓴다.
 */

export const DEFAULT_AI_ALLOW = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User"];
export const DEFAULT_AI_BLOCK = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "meta-externalagent"];

export const DISALLOWED_PATHS = ["/admin", "/search", "/api/"];

function list(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface RobotsRule {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
}

export function buildRobotsRules(): RobotsRule[] {
  const allow = list("AI_CRAWLERS_ALLOW", DEFAULT_AI_ALLOW);
  // 같은 봇이 양쪽에 있으면 차단을 우선한다
  const block = list("AI_CRAWLERS_BLOCK", DEFAULT_AI_BLOCK);
  const allowOnly = allow.filter((a) => !block.some((b) => b.toLowerCase() === a.toLowerCase()));

  const rules: RobotsRule[] = [{ userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS }];
  // 전용 그룹이 있는 봇은 '*' 그룹을 따르지 않으므로(RFC 9309) 허용 봇에도 같은 차단 경로를 명시한다
  if (allowOnly.length > 0) rules.push({ userAgent: allowOnly, allow: "/", disallow: DISALLOWED_PATHS });
  if (block.length > 0) rules.push({ userAgent: block, disallow: "/" });
  return rules;
}
