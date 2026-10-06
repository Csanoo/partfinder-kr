import { describe, expect, it } from "vitest";
import { checkTranslation, sourceHash, type TranslationSource } from "@/lib/parts/translate";

const src: TranslationSource = {
  summary: "LM358-N/NOPB는 3~32 V 단일 전원으로 동작하는 2채널 연산 증폭기입니다.",
  specs: [{ label: "채널 수", value: "2" }],
  faqs: [{ q: "대체품이 있나요?", a: "LM358BIDR이 핀 호환 대체품입니다." }],
  altNotes: [{ id: "a1", note: "핀 배치 동일" }],
};

const good = {
  summary: "LM358-N/NOPB is a 2-channel op-amp that runs from a 3~32 V single supply.",
  specs: [{ label: "Channels", value: "2" }],
  faqs: [{ q: "Is there an alternative?", a: "LM358BIDR is a pin-compatible alternative." }],
  altNotes: [{ id: "a1", note: "Same pinout" }],
};

describe("번역 검증", () => {
  it("개수·id·숫자·품번이 맞으면 통과", () => {
    expect(checkTranslation(src, good)).toEqual([]);
  });

  it("품번·숫자가 빠지면 실패", () => {
    const r = checkTranslation(src, { ...good, faqs: [{ q: "Alternative?", a: "There is a pin-compatible alternative." }] });
    expect(r.join(" ")).toContain("LM358BIDR");
  });

  it("개수·id 가 다르면 실패", () => {
    expect(checkTranslation(src, { ...good, specs: [] })).toContain("스펙 개수가 다릅니다.");
    expect(checkTranslation(src, { ...good, altNotes: [{ id: "x", note: "Same pinout" }] })).toContain("대체품 비고 id 가 다릅니다.");
  });

  it("원문 해시는 내용이 바뀔 때만 달라진다", () => {
    expect(sourceHash(src)).toBe(sourceHash({ ...src }));
    expect(sourceHash(src)).not.toBe(sourceHash({ ...src, summary: "다른 요약" }));
  });
});
