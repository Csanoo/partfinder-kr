import { describe, expect, it } from "vitest";
import { buildProposals, mergeSpecs } from "@/lib/manufacturer/proposals";
import type { ManufacturerFacts } from "@/lib/manufacturer/types";

const facts: ManufacturerFacts = {
  mpn: "LM358DR",
  sourceUrl: "https://www.ti.com/product/LM358/part-details/LM358DR",
  fetchedAt: "2026-10-01T05:00:00.000Z",
  lifecycle: "active",
  lifecycleRaw: "ACTIVE",
  package: "SOIC-8",
  packageRaw: "SOIC (D) | 8",
  datasheetUrl: "https://www.ti.com/lit/gpn/LM358",
  specs: [
    { label: "동작 온도", value: "0 to 70 °C" },
    { label: "핀 수", value: "8" },
  ],
};

describe("buildProposals", () => {
  it("빈 부품: 모든 항목 제안", () => {
    const p = buildProposals({ lifecycleStatus: "unknown", lifecycleCheckedAt: null, package: null, datasheetUrl: null, keySpecs: [] }, facts);
    expect(p.map((x) => [x.field, x.changed])).toEqual([
      ["lifecycle", true],
      ["package", true],
      ["datasheetUrl", true],
      ["specs", true],
    ]);
  });

  it("이미 같은 값이면 changed=false, 스펙은 없는 항목만", () => {
    const p = buildProposals(
      {
        lifecycleStatus: "active",
        lifecycleCheckedAt: new Date("2025-01-01"),
        package: "SOIC-8",
        datasheetUrl: "https://www.ti.com/lit/gpn/LM358",
        keySpecs: [
          { label: "동작 온도", value: "관리자 입력" },
          { label: "핀 수", value: "8" },
        ],
      },
      facts,
    );
    expect(p.find((x) => x.field === "package")!.changed).toBe(false);
    expect(p.find((x) => x.field === "datasheetUrl")!.changed).toBe(false);
    expect(p.some((x) => x.field === "specs")).toBe(false);
    // 수명주기는 확인일 갱신을 위해 항상 제안
    expect(p.find((x) => x.field === "lifecycle")!.changed).toBe(true);
  });

  it("제조사 상태가 unknown 이면 수명주기를 제안하지 않는다", () => {
    const p = buildProposals(
      { lifecycleStatus: "eol", lifecycleCheckedAt: null, package: null, datasheetUrl: null, keySpecs: [] },
      { ...facts, lifecycle: "unknown", lifecycleRaw: "PREVIEW" },
    );
    expect(p.some((x) => x.field === "lifecycle")).toBe(false);
  });
});

describe("mergeSpecs", () => {
  it("관리자 입력을 덮어쓰지 않는다", () => {
    expect(mergeSpecs([{ label: "핀 수", value: "관리자" }], facts.specs)).toEqual([
      { label: "핀 수", value: "관리자" },
      { label: "동작 온도", value: "0 to 70 °C" },
    ]);
  });
});
