import * as cheerio from "cheerio";
import { ProviderError } from "@/lib/providers/types";
import { fetchPage, type FetchPageDeps } from "@/lib/scrape/fetch-page";
import type { FactLifecycle, FetchFactsResult, ManufacturerFacts, ManufacturerSource } from "@/lib/manufacturer/types";

/**
 * Texas Instruments 공개 부품 상세 페이지 수집기.
 * - URL: https://www.ti.com/product/{대표품번}/part-details/{주문품번}
 *   주문 품번만으로는 페이지가 없어(404) 대표 품번 후보를 줄여 가며 찾는다.
 * - robots.txt 허용 경로, Crawl-delay 1초 → 요청 간격 1초 이상 (fetchPage + 호출 측 rate limit)
 * - TODO(확인필요): TI Product Information API 키 발급 시 API 방식으로 교체 (승인 필요)
 */

const BASE = "https://www.ti.com";
export const TI_MIN_INTERVAL_MS = 1100;
const MAX_CANDIDATES = 6;

/** TI 상태 표기 → 내부 수명주기. PREVIEW 등은 unknown (관리자 확인) */
export function mapTiStatus(raw: string): FactLifecycle {
  const s = raw.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (s === "ACTIVE") return "active";
  if (s === "NRND") return "nrnd";
  if (s === "LIFEBUY" || s === "LASTTIMEBUY" || s === "LTB") return "ltb";
  if (s === "OBSOLETE" || s === "DISCONTINUED") return "eol";
  return "unknown";
}

/** "SOIC (D) | 8" → "SOIC-8" */
export function normalizeTiPackage(raw: string): string | null {
  const m = /^\s*([A-Za-z0-9-]+)(?:\s*\([^)]*\))?\s*\|\s*(\d+)\s*$/.exec(raw);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

/**
 * 주문 품번 → 대표 품번 후보 (긴 것부터).
 * LM358DR → LM358D, LM358 / LM2596S-ADJ/NOPB → LM2596S-ADJ, LM2596S, LM2596 ...
 */
export function tiGenericCandidates(orderable: string): string[] {
  const base = orderable.trim().toUpperCase().split("/")[0];
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.replace(/[-.]+$/, "");
    if (t.length >= 3 && !out.includes(t)) out.push(t);
  };
  push(base);
  // 하이픈 뒤 접미사 제거 (예: LM2596S-ADJ → LM2596S)
  if (base.includes("-")) push(base.slice(0, base.lastIndexOf("-")));
  // 끝 글자를 하나씩 줄여 간다 (숫자 블록은 유지)
  let cur = out[out.length - 1];
  while (cur.length > 3 && out.length < MAX_CANDIDATES) {
    cur = cur.slice(0, -1);
    if (/\d$/.test(cur) || /[A-Z]$/.test(cur)) push(cur);
  }
  return out.slice(0, MAX_CANDIDATES);
}

export function partDetailsUrl(generic: string, orderable: string): string {
  return `${BASE}/product/${encodeURIComponent(generic)}/part-details/${orderable.split("/").map(encodeURIComponent).join("/")}`;
}

/** 부품 상세 HTML → 사실 정보. 설명 문장(short description)은 가져오지 않는다. */
export function parseTiPartDetails(html: string, sourceUrl: string, now = new Date()): ManufacturerFacts | null {
  const $ = cheerio.load(html);
  const mpn = $("h1.ti_ocb-pdp-product-title").first().text().trim();
  if (!mpn) return null;

  const statusRaw = $("ti-product-status").first().text().trim() || null;

  // "제목 | 값" 표 (Package | Pins, Operating temperature range 등)
  const rows = new Map<string, string>();
  $("span.ti_ocb-pdp-td-title").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    const value = $(el).nextAll("a,span").first().text().replace(/\s+/g, " ").trim();
    if (label && value && !rows.has(label)) rows.set(label, value);
  });

  const packageRaw = rows.get("Package | Pins") ?? null;
  const datasheetHref = $('a[href*="/lit/gpn/"]').first().attr("href") ?? null;
  const datasheetUrl = datasheetHref ? new URL(datasheetHref, BASE).toString() : null;

  const specs: { label: string; value: string }[] = [];
  const temp = rows.get("Operating temperature range (°C)");
  if (temp) specs.push({ label: "동작 온도", value: `${temp} °C` });
  const pins = packageRaw ? /\|\s*(\d+)/.exec(packageRaw)?.[1] : undefined;
  if (pins) specs.push({ label: "핀 수", value: pins });

  return {
    mpn,
    sourceUrl,
    fetchedAt: now.toISOString(),
    lifecycle: statusRaw ? mapTiStatus(statusRaw) : "unknown",
    lifecycleRaw: statusRaw,
    package: packageRaw ? normalizeTiPackage(packageRaw) : null,
    packageRaw,
    datasheetUrl,
    specs,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function tiSource(deps: FetchPageDeps & { sleepMs?: number } = {}): ManufacturerSource {
  return {
    id: "ti",
    manufacturerSlugs: ["texas-instruments"],
    async fetchFacts(mpn) {
      const orderable = mpn.trim().toUpperCase();
      const tried: string[] = [];
      for (const [i, generic] of tiGenericCandidates(orderable).entries()) {
        if (i > 0) await sleep(deps.sleepMs ?? TI_MIN_INTERVAL_MS); // Crawl-delay 준수
        const url = partDetailsUrl(generic, orderable);
        tried.push(url);
        let html: string;
        try {
          html = await fetchPage(url, deps);
        } catch (err) {
          const reason = err instanceof ProviderError ? err.reason : "error";
          return { status: "unavailable", reason };
        }
        if (html === "") continue; // 404 → 다음 후보
        const facts = parseTiPartDetails(html, url);
        if (facts && facts.mpn.toUpperCase() === orderable) return { status: "ok", facts };
      }
      return { status: "not_found", tried };
    },
  };
}

export type { FetchFactsResult };
