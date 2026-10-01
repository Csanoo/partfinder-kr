import { describe, expect, it } from "vitest";
import { normalizeMpn, parseQty, toSearchQuery } from "@/lib/search/normalize";

describe("normalizeMpn", () => {
  it("대문자로 바꾸고 모든 공백을 제거한다", () => {
    expect(normalizeMpn("  stm32 f103\tc8t6 ")).toBe("STM32F103C8T6");
  });

  it("하이픈 등 다른 문자는 유지한다", () => {
    expect(normalizeMpn("lm358-n/nopb")).toBe("LM358-N/NOPB");
  });
});

describe("toSearchQuery", () => {
  it("원본 검색어를 그대로 보존한다", () => {
    expect(toSearchQuery(" lm 358 ")).toEqual({ raw: " lm 358 ", normalized: "LM358" });
  });
});

describe("parseQty", () => {
  it.each([
    ["100", 100],
    [" 5 ", 5],
    ["", null],
    [null, null],
    [undefined, null],
    ["0", null],
    ["-3", null],
    ["1.5", null],
    ["abc", null],
    ["99999999999999999999", null],
  ])("parseQty(%j) = %j", (input, expected) => {
    expect(parseQty(input)).toBe(expected);
  });
});
