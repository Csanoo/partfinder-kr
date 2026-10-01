import type { SearchQuery } from "@/lib/providers/types";

/** 비교용 품번 정규화: 대문자 변환 + 모든 공백 제거. 하이픈 등 다른 문자는 유지한다. */
export function normalizeMpn(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** 원본 검색어는 그대로 보존하고, 비교용 정규화 값을 함께 만든다. */
export function toSearchQuery(raw: string): SearchQuery {
  return { raw, normalized: normalizeMpn(raw) };
}

/** 수량 파라미터 파싱. 양의 정수가 아니면 null. */
export function parseQty(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
