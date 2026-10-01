import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRobotsRules, DEFAULT_AI_ALLOW, DEFAULT_AI_BLOCK } from "@/lib/seo/robots-config";
import { chunkCount, maxDate, parseSitemapName, renderIndex, renderUrlset, sitemapChunkSize, sitemapFileName } from "@/lib/seo/sitemap";
import { parseRobots } from "@/lib/scrape/robots";

afterEach(() => vi.unstubAllEnvs());

describe("사이트맵 XML", () => {
  it("urlset: loc 이스케이프, lastmod ISO, lastmod 없으면 생략", () => {
    const xml = renderUrlset([
      { loc: "https://example.kr/parts/ti/a?x=1&y=2", lastmod: new Date("2026-10-01T00:00:00Z") },
      { loc: "https://example.kr/" },
    ]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://example.kr/parts/ti/a?x=1&amp;y=2</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<url><loc>https://example.kr/</loc></url>");
  });

  it("사이트맵 인덱스", () => {
    const xml = renderIndex([{ loc: "https://example.kr/sitemaps/parts-1.xml", lastmod: new Date("2026-10-01T00:00:00Z") }]);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<sitemap><loc>https://example.kr/sitemaps/parts-1.xml</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></sitemap>");
  });

  it("파일 이름 왕복", () => {
    expect(parseSitemapName(sitemapFileName("parts", 3))).toEqual({ type: "parts", page: 3 });
    for (const bad of ["parts-0.xml", "parts.xml", "other-1.xml", "parts-1.txt", "../parts-1.xml"]) expect(parseSitemapName(bad)).toBeNull();
  });

  it("파일당 50,000개 이하로 나눈다", () => {
    expect(sitemapChunkSize()).toBe(50_000);
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(50_000)).toBe(1);
    expect(chunkCount(50_001)).toBe(2);
    vi.stubEnv("SITEMAP_CHUNK_SIZE", "100000");
    expect(sitemapChunkSize()).toBe(50_000); // 상한 초과 값은 무시
    vi.stubEnv("SITEMAP_CHUNK_SIZE", "2");
    expect(chunkCount(5)).toBe(3);
  });

  it("maxDate", () => {
    expect(maxDate([null, new Date("2026-01-01"), new Date("2026-03-01"), undefined])?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(maxDate([])).toBeNull();
  });
});

/** robots.ts 가 만드는 규칙을 실제 robots.txt 텍스트로 만들어, 우리 robots 파서로 판정해 본다 */
function toRobotsTxt(rules: ReturnType<typeof buildRobotsRules>): string {
  const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  return rules
    .map((r) =>
      [...arr(r.userAgent).map((u) => `User-Agent: ${u}`), ...arr(r.allow).map((a) => `Allow: ${a}`), ...arr(r.disallow).map((d) => `Disallow: ${d}`)].join(
        "\n",
      ),
    )
    .join("\n\n");
}

describe("robots 규칙", () => {
  const txt = () => toRobotsTxt(buildRobotsRules());

  it("일반 크롤러: /admin·/search·/api 차단, 나머지 허용", () => {
    const r = parseRobots(txt(), "Googlebot/2.1");
    expect(r.isAllowed("/parts/texas-instruments/lm358-n_nopb")).toBe(true);
    expect(r.isAllowed("/admin/parts")).toBe(false);
    expect(r.isAllowed("/search?q=LM358")).toBe(false);
    expect(r.isAllowed("/api/availability?mpn=X")).toBe(false);
  });

  it.each(DEFAULT_AI_ALLOW)("검색·답변용 AI 허용: %s (단 /admin·/search 차단)", (bot) => {
    const r = parseRobots(txt(), `${bot}/1.0`);
    expect(r.isAllowed("/parts/x/y")).toBe(true);
    expect(r.isAllowed("/admin")).toBe(false);
    expect(r.isAllowed("/search?q=1")).toBe(false);
  });

  it.each(DEFAULT_AI_BLOCK)("학습용 AI 차단: %s", (bot) => {
    expect(parseRobots(txt(), `Mozilla/5.0 (compatible; ${bot}/1.0)`).isAllowed("/parts/x/y")).toBe(false);
  });

  it("환경변수로 목록을 바꿀 수 있고, 양쪽에 있으면 차단이 우선", () => {
    vi.stubEnv("AI_CRAWLERS_ALLOW", "GPTBot, NewSearchBot");
    vi.stubEnv("AI_CRAWLERS_BLOCK", "GPTBot");
    const rules = buildRobotsRules();
    expect(rules[1].userAgent).toEqual(["NewSearchBot"]);
    expect(rules[2].userAgent).toEqual(["GPTBot"]);
  });

  it("빈 목록이면 해당 그룹을 만들지 않는다", () => {
    vi.stubEnv("AI_CRAWLERS_ALLOW", "");
    vi.stubEnv("AI_CRAWLERS_BLOCK", "");
    expect(buildRobotsRules()).toHaveLength(1);
  });
});
