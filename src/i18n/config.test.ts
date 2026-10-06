import { describe, expect, it } from "vitest";
import { localePath, splitLocale } from "@/i18n/config";

describe("i18n 경로", () => {
  it("한국어는 접두어 없음, 나머지는 접두어", () => {
    expect(localePath("ko", "/request")).toBe("/request");
    expect(localePath("en", "/request")).toBe("/en/request");
    expect(localePath("ja", "/")).toBe("/ja");
  });

  it("주소에서 언어를 떼어 낸다", () => {
    expect(splitLocale("/en/parts/ti/lm358")).toEqual({ locale: "en", path: "/parts/ti/lm358" });
    expect(splitLocale("/es")).toEqual({ locale: "es", path: "/" });
    expect(splitLocale("/request")).toEqual({ locale: "ko", path: "/request" });
    // 두 글자로 시작하지만 언어가 아닌 경로
    expect(splitLocale("/eol")).toEqual({ locale: "ko", path: "/eol" });
    expect(splitLocale("/enx")).toEqual({ locale: "ko", path: "/enx" });
  });
});
