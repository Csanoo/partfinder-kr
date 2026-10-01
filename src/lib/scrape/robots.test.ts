import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRobots } from "@/lib/scrape/robots";

const hkinventory = readFileSync(join(process.cwd(), "fixtures/robots/hkinventory.txt"), "utf8");

describe("parseRobots: hkinventory 실제 robots.txt", () => {
  const robots = parseRobots(hkinventory, "partfinder-kr");

  it.each([
    "/p/d/ULN2003A.htm",
    "/p/d/BH1750FVI-TR.htm",
    "/member/Rfq.asp", // R은 금지 목록에 없음
    "/public/About.asp",
  ])("허용: %s", (path) => {
    expect(robots.isAllowed(path)).toBe(true);
  });

  it.each([
    "/part_number/ULN2003A",
    "/public/PartDetail.asp?pn=ULN2003A",
    "/member/Account.asp",
    "/member/CompanyBrief.asp?id=1",
    "/x/anything",
    "/Portlets/foo.asp",
    "/ReferralProxy/abc",
  ])("금지: %s", (path) => {
    expect(robots.isAllowed(path)).toBe(false);
  });

  it("전용 그룹이 있는 봇은 그 그룹 규칙을 따른다 (AhrefsBot 전체 금지)", () => {
    expect(parseRobots(hkinventory, "AhrefsBot/7.0").isAllowed("/p/d/ULN2003A.htm")).toBe(false);
  });
});

describe("parseRobots: 규칙 우선순위", () => {
  it("더 구체적인(긴) 규칙이 이긴다", () => {
    const r = parseRobots("User-agent: *\nDisallow: /p/\nAllow: /p/d/", "x");
    expect(r.isAllowed("/p/d/A.htm")).toBe(true);
    expect(r.isAllowed("/p/x")).toBe(false);
  });

  it("길이가 같으면 Allow 우선", () => {
    const r = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a", "x");
    expect(r.isAllowed("/a")).toBe(true);
  });

  it("$ 끝 고정", () => {
    const r = parseRobots("User-agent: *\nDisallow: /*.php$", "x");
    expect(r.isAllowed("/index.php")).toBe(false);
    expect(r.isAllowed("/index.php?x=1")).toBe(true);
  });

  it("빈 Disallow는 모두 허용", () => {
    expect(parseRobots("User-agent: *\nDisallow:", "x").isAllowed("/any")).toBe(true);
  });

  it("주석과 빈 줄을 무시한다", () => {
    const r = parseRobots("# comment\n\nUser-agent: * # all\nDisallow: /private # secret\n", "x");
    expect(r.isAllowed("/private/a")).toBe(false);
  });

  it("연속된 User-agent 줄은 한 그룹", () => {
    const r = parseRobots("User-agent: foo\nUser-agent: partfinder-kr\nDisallow: /\nUser-agent: *\nDisallow:", "partfinder-kr/0.1");
    expect(r.isAllowed("/a")).toBe(false);
  });
});
