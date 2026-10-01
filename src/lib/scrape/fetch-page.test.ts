import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/providers/types";
import { TtlCache } from "@/lib/search/cache";
import { fetchPage } from "@/lib/scrape/fetch-page";
import type { RobotsRules } from "@/lib/scrape/robots";

const hkRobots = readFileSync(join(process.cwd(), "fixtures/robots/hkinventory.txt"), "utf8");

function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (input: string, _init?: RequestInit) => {
    const handler = routes[input];
    if (handler == null) return new Response("not found", { status: 404 });
    return handler();
  });
}

function deps(routes: Record<string, () => Response | Promise<Response>>) {
  const fetchImpl = fakeFetch(routes);
  return { fetchImpl, robotsCache: new TtlCache<RobotsRules>() };
}

async function reasonOf(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ProviderError ? e.reason : "other";
  }
}

const ORIGIN = "https://www.hkinventory.com";

describe("fetchPage", () => {
  it("robots.txt 허용 경로는 가져온다 + 식별 가능한 UA를 보낸다", async () => {
    const d = deps({
      [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots),
      [`${ORIGIN}/p/d/ULN2003A.htm`]: () => new Response("<html>ok</html>"),
    });
    expect(await fetchPage(`${ORIGIN}/p/d/ULN2003A.htm`, d)).toBe("<html>ok</html>");
    const init = d.fetchImpl.mock.calls[1][1]!;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^partfinder-kr\//);
  });

  it("robots.txt 금지 경로는 요청하지 않는다 (disallowed)", async () => {
    const d = deps({ [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots) });
    expect(await reasonOf(fetchPage(`${ORIGIN}/public/PartDetail.asp?pn=X`, d))).toBe("disallowed");
    expect(d.fetchImpl).toHaveBeenCalledTimes(1); // robots.txt만
  });

  it("robots.txt는 캐시해서 매번 요청하지 않는다", async () => {
    const d = deps({
      [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots),
      [`${ORIGIN}/p/d/A.htm`]: () => new Response("a"),
      [`${ORIGIN}/p/d/B.htm`]: () => new Response("b"),
    });
    await fetchPage(`${ORIGIN}/p/d/A.htm`, d);
    await fetchPage(`${ORIGIN}/p/d/B.htm`, d);
    expect(d.fetchImpl.mock.calls.filter((c) => c[0].endsWith("/robots.txt"))).toHaveLength(1);
  });

  it("robots.txt가 404면 제한 없음", async () => {
    const d = deps({ [`${ORIGIN}/x`]: () => new Response("ok") });
    expect(await fetchPage(`${ORIGIN}/x`, d)).toBe("ok");
  });

  it("robots.txt가 5xx면 보수적으로 전부 금지", async () => {
    const d = deps({ [`${ORIGIN}/robots.txt`]: () => new Response("", { status: 500 }) });
    expect(await reasonOf(fetchPage(`${ORIGIN}/p/d/A.htm`, d))).toBe("disallowed");
  });

  it.each([401, 403, 429, 503])("HTTP %i는 blocked", async (status) => {
    const d = deps({
      [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots),
      [`${ORIGIN}/p/d/A.htm`]: () => new Response("", { status }),
    });
    expect(await reasonOf(fetchPage(`${ORIGIN}/p/d/A.htm`, d))).toBe("blocked");
  });

  it("CAPTCHA·챌린지 페이지는 blocked (우회하지 않음)", async () => {
    const d = deps({
      [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots),
      [`${ORIGIN}/p/d/A.htm`]: () => new Response("<title>Just a moment...</title>"),
    });
    expect(await reasonOf(fetchPage(`${ORIGIN}/p/d/A.htm`, d))).toBe("blocked");
  });

  it("상품 페이지 404는 빈 문자열 (결과 없음)", async () => {
    const d = deps({ [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots) });
    expect(await fetchPage(`${ORIGIN}/p/d/NOPE.htm`, d)).toBe("");
  });

  it("그 외 오류 상태는 error", async () => {
    const d = deps({
      [`${ORIGIN}/robots.txt`]: () => new Response(hkRobots),
      [`${ORIGIN}/p/d/A.htm`]: () => new Response("", { status: 500 }),
    });
    expect(await reasonOf(fetchPage(`${ORIGIN}/p/d/A.htm`, d))).toBe("error");
  });
});
