import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/parts/csv";
import { planImport, type ExistingIndex } from "@/lib/parts/import-plan";
import { formatKeySpecs, parseDateOnly, parseKeySpecs, validateDatasheetUrl } from "@/lib/parts/validate-part";

describe("parseCsv", () => {
  it("따옴표·쉼표·줄바꿈·이스케이프·CRLF·BOM", () => {
    const text = '﻿mpn,note\r\n"BAV99,215","say ""hi"""\r\n"A\nB",x\n\n';
    expect(parseCsv(text)).toEqual([
      ["mpn", "note"],
      ["BAV99,215", 'say "hi"'],
      ["A\nB", "x"],
    ]);
  });

  it("마지막 줄에 줄바꿈이 없어도 읽는다", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("빈 필드 유지", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([["a", "", "c"]]);
  });
});

const existing = (): ExistingIndex => ({
  manufacturers: new Map([
    ["texas-instruments", "texas-instruments"],
    ["texas instruments", "texas-instruments"],
    ["텍사스 인스트루먼트", "texas-instruments"],
  ]),
  categories: new Map([
    ["amplifiers", "amplifiers"],
    ["증폭기", "amplifiers"],
  ]),
  partKeys: new Set(["texas-instruments|LM358N/NOPB"]),
});

describe("planImport", () => {
  it("기본 필드를 읽어 draft 생성 계획을 만든다", () => {
    const csv = [
      "mpn,manufacturer,category,package,lifecycle_status,eol_date,lifecycle_checked_at,datasheet_url",
      "SN74HC595N,Texas Instruments,증폭기,DIP-16,active,,2026-09-01,https://www.ti.com/lit/ds/symlink/sn74hc595.pdf",
    ].join("\n");
    const plan = planImport(csv, existing());
    expect(plan.errors).toEqual([]);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]).toMatchObject({
      line: 2,
      mpn: "SN74HC595N",
      manufacturerSlug: "texas-instruments",
      categorySlug: "amplifiers",
      package: "DIP-16",
      lifecycleStatus: "active",
      eolDate: null,
    });
    expect(plan.create[0].lifecycleCheckedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("한글 헤더도 받는다", () => {
    const plan = planImport("품번,제조사,수명주기\nTPS54331DR,텍사스 인스트루먼트,eol", existing());
    expect(plan.create[0]).toMatchObject({ mpn: "TPS54331DR", manufacturerSlug: "texas-instruments", lifecycleStatus: "eol" });
  });

  it("필수 열이 없으면 전체 거부", () => {
    expect(planImport("mpn,package\nX,SOIC-8", existing()).errors[0].message).toContain("manufacturer");
  });

  it("이미 등록된 부품(하이픈만 다른 표기 포함)과 파일 안 중복은 건너뛴다", () => {
    const plan = planImport("mpn,manufacturer\nLM358N/NOPB,Texas Instruments\nLM358-N/NOPB,TI\nX1,Texas Instruments\nX-1,Texas Instruments", {
      ...existing(),
      manufacturers: new Map([...existing().manufacturers, ["ti", "texas-instruments"]]),
    });
    expect(plan.skipped.map((s) => [s.line, s.reason])).toEqual([
      [2, "이미 등록된 부품"],
      [3, "이미 등록된 부품"],
      [5, "파일 안 중복"],
    ]);
    expect(plan.create.map((c) => c.mpn)).toEqual(["X1"]);
  });

  it("새 영문 제조사는 생성 목록에, 한글 이름의 새 제조사는 오류", () => {
    const plan = planImport("mpn,manufacturer\nA1,Analog Devices\nB1,삼성전기", existing());
    expect([...plan.newManufacturers]).toEqual([["analog-devices", "Analog Devices"]]);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0]).toMatchObject({ line: 3 });
    expect(plan.errors[0].message).toContain("영문명");
  });

  it("등록되지 않은 카테고리는 오류", () => {
    const plan = planImport("mpn,manufacturer,category\nA1,Texas Instruments,커넥터", existing());
    expect(plan.errors[0].message).toContain("등록되지 않은 카테고리");
  });

  it("행 단위 검증 오류를 모아서 알려 준다", () => {
    const csv = "mpn,manufacturer,lifecycle_status,eol_date,datasheet_url\n,Texas Instruments,dead,2026-02-30,https://www.mouser.com/ds/x.pdf";
    const plan = planImport(csv, existing());
    const msg = plan.errors[0].message;
    expect(msg).toContain("품번");
    expect(msg).toContain("수명주기");
    expect(msg).toContain("존재하지 않는 날짜");
    expect(msg).toContain("제조사 공식 URL");
    expect(plan.create).toEqual([]);
  });

  it("빈 파일", () => {
    expect(planImport("", existing()).errors[0].message).toBe("빈 파일입니다.");
  });
});

describe("validateDatasheetUrl", () => {
  it.each([
    ["https://www.ti.com/lit/ds/symlink/lm358.pdf", true],
    ["", true],
    ["http://www.ti.com/x.pdf", false],
    ["https://www.digikey.kr/ko/products/x", false],
    ["https://www.alldatasheet.com/view.jsp?x", false],
    ["not a url", false],
  ])("%s → %s", (url, ok) => {
    expect(validateDatasheetUrl(url).ok).toBe(ok);
  });
});

describe("parseDateOnly", () => {
  it.each([
    ["2026-02-28", "2026-02-28T00:00:00.000Z"],
    ["2028-02-29", "2028-02-29T00:00:00.000Z"],
  ])("%s", (s, iso) => {
    const r = parseDateOnly(s);
    expect(r.ok && r.date?.toISOString()).toBe(iso);
  });
  it.each(["2026-02-29", "2026-13-01", "2026/01/01", "26-01-01"])("거부: %s", (s) => {
    expect(parseDateOnly(s).ok).toBe(false);
  });
});

describe("key_specs 텍스트", () => {
  it("'라벨: 값' 줄 ↔ JSON 왕복", () => {
    const specs = parseKeySpecs("채널 수: 2\n\n 공급 전압 : 3~32 V \n대역폭: 1 MHz: typ");
    expect(specs).toEqual([
      { label: "채널 수", value: "2" },
      { label: "공급 전압", value: "3~32 V" },
      { label: "대역폭", value: "1 MHz: typ" },
    ]);
    expect(parseKeySpecs(formatKeySpecs(specs))).toEqual(specs);
  });
});
