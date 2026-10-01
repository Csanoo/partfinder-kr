/** 부품 필드 검증 (관리자 편집·CSV 가져오기 공통) */

export const LIFECYCLE_VALUES = ["active", "nrnd", "ltb", "eol", "unknown"] as const;
export type Lifecycle = (typeof LIFECYCLE_VALUES)[number];

/**
 * 데이터시트는 제조사 공식 URL만 허용한다 (SEO_SPEC 제약 5).
 * 유통사·데이터시트 모음 사이트는 거부한다. 목록에 없는 도메인은 관리자가 확인한다.
 */
const NON_MANUFACTURER_DOMAINS = [
  "digikey.",
  "mouser.",
  "arrow.com",
  "avnet.com",
  "farnell.com",
  "element14.com",
  "newark.com",
  "rs-online.com",
  "lcsc.com",
  "szlcsc.com",
  "tme.eu",
  "heisener.com",
  "censtry.com",
  "worldwayelec",
  "hkinventory.com",
  "alldatasheet.",
  "datasheetspdf.",
  "datasheet4u.",
  "octopart.com",
  "findchips.com",
];

export function validateDatasheetUrl(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (s === "") return { ok: true, url: null };
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, error: "URL 형식이 올바르지 않습니다." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "https 주소만 허용합니다." };
  const host = url.hostname.toLowerCase();
  if (NON_MANUFACTURER_DOMAINS.some((d) => host.includes(d))) {
    return { ok: false, error: "제조사 공식 URL만 허용합니다 (유통사·데이터시트 모음 사이트 불가)." };
  }
  return { ok: true, url: url.toString() };
}

/** YYYY-MM-DD → Date(UTC 자정). 빈 값은 null */
export function parseDateOnly(raw: string): { ok: true; date: Date | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (s === "") return { ok: true, date: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: "날짜는 YYYY-MM-DD 형식이어야 합니다." };
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return { ok: false, error: "존재하지 않는 날짜입니다." };
  }
  return { ok: true, date: d };
}

export function parseLifecycle(raw: string): Lifecycle | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return "unknown";
  return (LIFECYCLE_VALUES as readonly string[]).includes(s) ? (s as Lifecycle) : null;
}

/** "라벨: 값" 줄 단위 텍스트 ↔ key_specs JSON */
export function parseKeySpecs(text: string): { label: string; value: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i < 0 ? { label: line, value: "" } : { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((s) => s.label !== "");
}

export function formatKeySpecs(specs: unknown): string {
  if (!Array.isArray(specs)) return "";
  return specs
    .filter((s): s is { label: string; value: string } => typeof s?.label === "string" && typeof s?.value === "string")
    .map((s) => `${s.label}: ${s.value}`)
    .join("\n");
}
