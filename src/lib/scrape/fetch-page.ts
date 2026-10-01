import { ProviderError } from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";
import { ALLOW_ALL, DISALLOW_ALL, parseRobots, type RobotsRules } from "@/lib/scrape/robots";

/** UA 토큰. robots.txt 그룹 매칭에도 쓴다. */
export const USER_AGENT_TOKEN = "partfinder-kr";

/**
 * 식별 가능한 User-Agent. 브라우저로 위장하지 않는다.
 * TODO(확인필요): 연락처 URL (사이트 운영자가 문의할 수 있는 페이지)
 */
export function userAgent(): string {
  return process.env.SCRAPER_USER_AGENT ?? `${USER_AGENT_TOKEN}/0.1 (+contact: TODO)`;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchPageDeps {
  fetchImpl?: FetchLike;
  robotsCache?: TtlCache<RobotsRules>;
}

const ROBOTS_TTL_SECONDS = 24 * 3600;
const g = globalThis as unknown as { __robotsCache?: TtlCache<RobotsRules> };
const defaultRobotsCache = (g.__robotsCache ??= new TtlCache<RobotsRules>());

/** 차단·봇 확인 페이지로 보이는 응답 표식. 감지되면 우회하지 않고 blocked 처리한다. */
const BLOCK_MARKERS = [
  /captcha/i,
  /cf-chl-|challenge-platform/i,
  /just a moment\.\.\./i,
  /attention required/i,
  /access denied/i,
  /are you a robot/i,
];

/**
 * 공개 웹페이지 한 장을 가져온다 (수집 가드레일 적용).
 * - robots.txt에서 금지한 경로면 요청하지 않고 disallowed
 * - 401/403/429/503, CAPTCHA·챌린지 페이지면 blocked (호출 측에서 쿨다운)
 * - 쿠키·로그인 세션을 쓰지 않는다
 */
export async function fetchPage(url: string, deps: FetchPageDeps = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const robotsCache = deps.robotsCache ?? defaultRobotsCache;
  const target = new URL(url);

  const robots = await getRobots(target.origin, fetchImpl, robotsCache);
  if (!robots.isAllowed(target.pathname + target.search)) {
    throw new ProviderError("disallowed", `robots.txt disallows ${target.pathname}`);
  }

  const res = await fetchImpl(url, {
    headers: { "User-Agent": userAgent(), Accept: "text/html" },
    redirect: "follow",
    credentials: "omit",
  });

  if ([401, 403, 429, 503].includes(res.status)) {
    throw new ProviderError("blocked", `HTTP ${res.status} from ${target.host}`);
  }
  if (res.status === 404) return "";
  if (!res.ok) throw new ProviderError("error", `HTTP ${res.status} from ${target.host}`);

  const html = await res.text();
  if (BLOCK_MARKERS.some((m) => m.test(html.slice(0, 20_000)))) {
    throw new ProviderError("blocked", `challenge page from ${target.host}`);
  }
  return html;
}

async function getRobots(origin: string, fetchImpl: FetchLike, cache: TtlCache<RobotsRules>): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) return cached;

  let rules: RobotsRules;
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, { headers: { "User-Agent": userAgent() } });
    if (res.ok) rules = parseRobots(await res.text(), USER_AGENT_TOKEN);
    // RFC 9309: 4xx면 제한 없음, 5xx·네트워크 오류면 전부 금지로 간주
    else if (res.status >= 400 && res.status < 500) rules = ALLOW_ALL;
    else rules = DISALLOW_ALL;
  } catch {
    rules = DISALLOW_ALL;
  }
  cache.set(origin, rules, rules === DISALLOW_ALL ? 600 : ROBOTS_TTL_SECONDS);
  return rules;
}
