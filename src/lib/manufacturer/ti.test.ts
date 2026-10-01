import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mapTiStatus, normalizeTiPackage, parseTiPartDetails, partDetailsUrl, tiGenericCandidates, tiSource } from "@/lib/manufacturer/ti";
import { TtlCache } from "@/lib/search/cache";
import type { RobotsRules } from "@/lib/scrape/robots";

/** 2026-10-01 TI 공개 페이지 저장본 (robots.txt 허용 경로) */
const html = readFileSync(join(process.cwd(), "fixtures/html/ti/LM358DR.html"), "utf8");
const URL_ = "https://www.ti.com/product/LM358/part-details/LM358DR";

describe("parseTiPartDetails (실제 페이지 저장본)", () => {
  const facts = parseTiPartDetails(html, URL_, new Date("2026-10-01T00:00:00Z"))!;

  it("주문 품번·수명주기·패키지·데이터시트", () => {
    expect(facts).toMatchObject({
      mpn: "LM358DR",
      sourceUrl: URL_,
      lifecycle: "active",
      lifecycleRaw: "ACTIVE",
      package: "SOIC-8",
      packageRaw: "SOIC (D) | 8",
      datasheetUrl: "https://www.ti.com/lit/gpn/LM358",
    });
  });

  it("사실 항목만 스펙으로 (온도 범위·핀 수)", () => {
    expect(facts.specs).toEqual([
      { label: "동작 온도", value: "0 to 70 °C" },
      { label: "핀 수", value: "8" },
    ]);
  });

  it("제조사 설명 문장은 가져오지 않는다", () => {
    expect(JSON.stringify(facts)).not.toContain("operational amplifier");
  });

  it.each([
    ["NRND", "nrnd"],
    ["LIFEBUY", "ltb"],
    ["OBSOLETE", "eol"],
    ["PREVIEW", "unknown"],
  ])("상태 %s → %s (같은 페이지 구조)", (raw, expected) => {
    const changed = html.replaceAll('data-navtitle="ACTIVE"\n                >ACTIVE</a>', `data-navtitle="${raw}"\n                >${raw}</a>`);
    expect(changed).not.toBe(html);
    expect(parseTiPartDetails(changed, URL_)!.lifecycle).toBe(expected);
  });

  it("상품 페이지가 아니면 null", () => {
    expect(parseTiPartDetails("<html><body>Not found</body></html>", URL_)).toBeNull();
  });
});

describe("TI 표기 변환", () => {
  it.each([
    ["ACTIVE", "active"],
    ["nrnd", "nrnd"],
    ["Last Time Buy", "ltb"],
    ["Discontinued", "eol"],
    ["???", "unknown"],
  ])("mapTiStatus(%s) = %s", (raw, v) => expect(mapTiStatus(raw)).toBe(v));

  it.each([
    ["SOIC (D) | 8", "SOIC-8"],
    ["VSSOP (DGK) | 8", "VSSOP-8"],
    ["TO-220 (KCS) | 3", "TO-220-3"],
    ["weird", null],
  ])("normalizeTiPackage(%s) = %s", (raw, v) => expect(normalizeTiPackage(raw)).toBe(v));

  it("대표 품번 후보: 끝 글자를 줄여 간다", () => {
    expect(tiGenericCandidates("LM358DR")).toEqual(["LM358DR", "LM358D", "LM358", "LM35", "LM3"]);
    expect(tiGenericCandidates("SN74HC595N").slice(0, 2)).toEqual(["SN74HC595N", "SN74HC595"]);
    expect(tiGenericCandidates("LM2596S-ADJ/NOPB").slice(0, 3)).toEqual(["LM2596S-ADJ", "LM2596S", "LM2596"]);
    expect(tiGenericCandidates("TPS54331DR")).toContain("TPS54331");
  });

  it("상세 URL: 슬래시가 있는 주문 품번은 경로 그대로", () => {
    expect(partDetailsUrl("LM2596", "LM2596S-ADJ/NOPB")).toBe("https://www.ti.com/product/LM2596/part-details/LM2596S-ADJ/NOPB");
  });
});

describe("tiSource.fetchFacts", () => {
  const robots = "User-agent: *\nCrawl-delay: 1\nDisallow: /productmodel/\n";
  function deps(pages: Record<string, () => Response>) {
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === "https://www.ti.com/robots.txt") return new Response(robots);
      return (pages[input] ?? (() => new Response("", { status: 404 })))();
    });
    return { fetchImpl, robotsCache: new TtlCache<RobotsRules>(), sleepMs: 0 };
  }

  it("대표 품번 후보를 차례로 시도해 찾는다 (404는 다음 후보)", async () => {
    const d = deps({ [URL_]: () => new Response(html) });
    const r = await tiSource(d).fetchFacts("lm358dr");
    expect(r.status).toBe("ok");
    const pageCalls = d.fetchImpl.mock.calls.map((c) => c[0]).filter((u) => !u.endsWith("robots.txt"));
    expect(pageCalls).toEqual([
      "https://www.ti.com/product/LM358DR/part-details/LM358DR",
      "https://www.ti.com/product/LM358D/part-details/LM358DR",
      URL_,
    ]);
  });

  it("어느 후보에도 없으면 not_found", async () => {
    const r = await tiSource(deps({})).fetchFacts("NOPE123");
    expect(r.status).toBe("not_found");
  });

  it("차단 응답(403)이면 우회하지 않고 즉시 중단", async () => {
    const d = deps({ "https://www.ti.com/product/X123/part-details/X123": () => new Response("", { status: 403 }) });
    const r = await tiSource(d).fetchFacts("X123");
    expect(r).toEqual({ status: "unavailable", reason: "blocked" });
    expect(d.fetchImpl.mock.calls.filter((c) => !c[0].endsWith("robots.txt"))).toHaveLength(1);
  });
});
