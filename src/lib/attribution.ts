/**
 * 유입 측정 (docs/SEO_SPEC.md 8장).
 * 첫 방문 정보(랜딩 URL, referrer, UTM, 시각)를 쿠키에 한 번만 기록하고, 문의 접수 시 함께 저장한다.
 * 개인 식별 정보는 담지 않는다.
 */

export const ATTRIBUTION_COOKIE = "pf_attr";
const MAX_LEN = 300;

export type TrafficSource = "google" | "naver" | "ai" | "other_search" | "referral" | "direct";

export interface FirstTouch {
  landingUrl: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstVisitAt: string;
  trafficSource: TrafficSource;
}

const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "you.com",
  "wrtn.ai",
  "liner.com",
];
const OTHER_SEARCH_HOSTS = ["bing.com", "daum.net", "search.daum.net", "duckduckgo.com", "yahoo.com", "zum.com", "baidu.com"];

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * 유입 경로 분류: UTM source 우선, 없으면 referrer 호스트.
 * (ChatGPT 등은 링크에 utm_source=chatgpt.com 을 붙이는 경우가 많다)
 */
export function classifyTraffic(referrer: string | null, utmSource: string | null, siteHost?: string): TrafficSource {
  const utm = utmSource?.trim().toLowerCase();
  if (utm) {
    if (AI_HOSTS.some((h) => utm.includes(h.split(".")[0])) || /chatgpt|openai|perplexity|claude|gemini|copilot/.test(utm)) return "ai";
    if (utm.includes("google")) return "google";
    if (utm.includes("naver")) return "naver";
  }
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (siteHost && hostMatches(host, siteHost.toLowerCase())) return "direct";
  if (AI_HOSTS.some((d) => hostMatches(host, d))) return "ai";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
  if (hostMatches(host, "naver.com")) return "naver";
  if (OTHER_SEARCH_HOSTS.some((d) => hostMatches(host, d))) return "other_search";
  return "referral";
}

const clip = (s: string | null | undefined) => (s ? s.slice(0, MAX_LEN) : null);

export function buildFirstTouch(url: URL, referrer: string | null, now = new Date()): FirstTouch {
  const q = url.searchParams;
  const utmSource = clip(q.get("utm_source"));
  // 같은 사이트 안에서 온 referrer 는 외부 유입이 아니다
  const externalRef = referrer && safeHost(referrer) !== url.hostname ? clip(referrer) : null;
  return {
    landingUrl: clip(url.pathname + url.search)!,
    referrer: externalRef,
    utmSource,
    utmMedium: clip(q.get("utm_medium")),
    utmCampaign: clip(q.get("utm_campaign")),
    firstVisitAt: now.toISOString(),
    trafficSource: classifyTraffic(externalRef, utmSource, url.hostname),
  };
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

export function encodeFirstTouch(t: FirstTouch): string {
  return Buffer.from(JSON.stringify(t), "utf8").toString("base64url");
}

/** 쿠키 값 → FirstTouch. 형식이 틀리면 null (조작된 값도 길이·형식만 맞으면 그대로 쓰므로 표시 용도로만 쓴다) */
export function decodeFirstTouch(raw: string | undefined | null): FirstTouch | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<FirstTouch>;
    const sources: TrafficSource[] = ["google", "naver", "ai", "other_search", "referral", "direct"];
    if (typeof v.landingUrl !== "string" || typeof v.firstVisitAt !== "string" || !sources.includes(v.trafficSource as TrafficSource)) return null;
    if (Number.isNaN(Date.parse(v.firstVisitAt))) return null;
    const str = (x: unknown) => (typeof x === "string" ? x.slice(0, MAX_LEN) : null);
    return {
      landingUrl: v.landingUrl.slice(0, MAX_LEN),
      referrer: str(v.referrer),
      utmSource: str(v.utmSource),
      utmMedium: str(v.utmMedium),
      utmCampaign: str(v.utmCampaign),
      firstVisitAt: v.firstVisitAt,
      trafficSource: v.trafficSource as TrafficSource,
    };
  } catch {
    return null;
  }
}

export const TRAFFIC_LABEL: Record<TrafficSource, string> = {
  google: "구글",
  naver: "네이버",
  ai: "AI 답변",
  other_search: "기타 검색",
  referral: "다른 사이트",
  direct: "직접",
};
