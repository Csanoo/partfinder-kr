import { describe, expect, it } from "vitest";
import { parsePackage } from "@/lib/package/parse-package";

describe("parsePackage", () => {
  it.each([
    ["[MOCK] 32-bit MCU, 64KB Flash, LQFP-48", "quad", 48, "LQFP-48"],
    ["MCU TQFP100", "quad", 100, "TQFP-100"],
    ["Op-Amp Dual, SOIC-8", "dual", 8, "SOIC-8"],
    ["Buffer TSSOP-20", "dual", 20, "TSSOP-20"],
    ["EEPROM SO8", "dual", 8, "SO-8"],
    ["Timer PDIP-8", "dip", 8, "PDIP-8"],
    ["Darlington array DIP16", "dip", 16, "DIP-16"],
    ["LDO 3.3V, SOT-223", "sot223", 4, "SOT-223"],
    ["MOSFET SOT-23", "sot23", 3, "SOT-23"],
    ["LDO SOT-23-5", "sot23", 5, "SOT-23-5"],
    ["Regulator TO-220AB", "to220", 3, "TO-220"],
    ["Transistor TO-92", "to92", 3, "TO-92"],
    ["PMIC VQFN-32", "qfn", 32, "VQFN-32"],
    ["Switch DFN8", "qfn", 8, "DFN-8"],
    ["FPGA FBGA-256", "bga", 256, "FBGA-256"],
    ["Resistor 10k 0603", "chip", 2, "0603"],
  ])("%s → %s", (text, family, pins, label) => {
    expect(parsePackage(text)).toEqual({ family, pins, label });
  });

  it("SOT-223을 SOT-23으로 잘못 읽지 않는다", () => {
    expect(parsePackage("SOT223").family).toBe("sot223");
  });

  it("모르는 패키지는 unknown", () => {
    expect(parsePackage("CAN Transceiver").family).toBe("unknown");
    expect(parsePackage(null).family).toBe("unknown");
  });

  it("단어 일부에 걸리지 않는다 (예: ALSO8 같은 문자열)", () => {
    expect(parsePackage("ALSO8 module").family).toBe("unknown");
  });
});
