import { describe, expect, it } from "vitest";
import { buildFirstTouch, classifyTraffic, decodeFirstTouch, encodeFirstTouch } from "@/lib/attribution";

describe("classifyTraffic", () => {
  it.each([
    ["https://www.google.com/", null, "google"],
    ["https://www.google.co.kr/search?q=x", null, "google"],
    ["https://search.naver.com/search.naver?query=x", null, "naver"],
    ["https://m.search.naver.com/", null, "naver"],
    ["https://chatgpt.com/", null, "ai"],
    ["https://www.perplexity.ai/search/x", null, "ai"],
    ["https://claude.ai/chat/x", null, "ai"],
    ["https://gemini.google.com/app", null, "ai"],
    ["https://www.bing.com/search?q=x", null, "other_search"],
    ["https://search.daum.net/search?q=x", null, "other_search"],
    ["https://some-blog.tistory.com/1", null, "referral"],
    [null, null, "direct"],
    ["not a url", null, "direct"],
    [null, "chatgpt.com", "ai"],
    [null, "perplexity", "ai"],
    [null, "google", "google"],
    ["https://some-blog.tistory.com/1", "naver_blog", "naver"],
  ])("ref=%s utm=%s → %s", (ref, utm, expected) => {
    expect(classifyTraffic(ref, utm)).toBe(expected);
  });

  it("자기 사이트 referrer 는 direct", () => {
    expect(classifyTraffic("https://ms.example/parts/a/b", null, "ms.example")).toBe("direct");
  });

  it("googleusercontent·googleblog 같은 비검색 구글 호스트를 google 로 오인하지 않는다", () => {
    expect(classifyTraffic("https://example.googleblog.com/", null)).toBe("referral");
  });
});

describe("buildFirstTouch", () => {
  const now = new Date("2026-10-02T00:00:00Z");

  it("랜딩 URL·UTM·referrer·시각·유입 경로", () => {
    const t = buildFirstTouch(
      new URL("https://ms.example/parts/ti/lm358?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=x"),
      "https://chatgpt.com/",
      now,
    );
    expect(t).toEqual({
      landingUrl: "/parts/ti/lm358?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=x",
      referrer: "https://chatgpt.com/",
      utmSource: "chatgpt.com",
      utmMedium: "referral",
      utmCampaign: "x",
      firstVisitAt: "2026-10-02T00:00:00.000Z",
      trafficSource: "ai",
    });
  });

  it("사이트 내부 referrer 는 기록하지 않는다", () => {
    const t = buildFirstTouch(new URL("https://ms.example/eol"), "https://ms.example/", now);
    expect(t.referrer).toBeNull();
    expect(t.trafficSource).toBe("direct");
  });

  it("긴 값은 자른다", () => {
    const t = buildFirstTouch(new URL(`https://ms.example/?utm_source=${"a".repeat(1000)}`), null, now);
    expect(t.utmSource!.length).toBe(300);
  });
});

describe("쿠키 인코딩", () => {
  it("왕복", () => {
    const t = buildFirstTouch(new URL("https://ms.example/parts/a/b"), "https://www.google.com/", new Date("2026-10-02T00:00:00Z"));
    expect(decodeFirstTouch(encodeFirstTouch(t))).toEqual(t);
  });

  it.each([undefined, "", "not-base64!", Buffer.from('{"landingUrl":1}').toString("base64url"), "x".repeat(5000)])("잘못된 값은 null: %s", (raw) => {
    expect(decodeFirstTouch(raw as string | undefined)).toBeNull();
  });

  it("허용되지 않은 유입 경로 값은 거부", () => {
    const bad = Buffer.from(JSON.stringify({ landingUrl: "/", firstVisitAt: "2026-10-02T00:00:00Z", trafficSource: "hacker" })).toString("base64url");
    expect(decodeFirstTouch(bad)).toBeNull();
  });
});
