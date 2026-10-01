import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

/** GET /api/availability?mpn= — 부품 페이지 정식 유통사 재고 (브라우저 측 호출) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // TODO(확인필요): 배포 환경의 프록시 구성에 맞춰 신뢰할 IP 헤더 확정
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const res = await getAvailability(url.searchParams.get("mpn"), req.headers.get("user-agent"), ip);

  const status = res.kind === "invalid" ? 400 : res.kind === "rate_limited" ? 429 : 200;
  return Response.json(res, {
    status,
    headers: {
      // 개인화 정보는 없지만 유통사 쿼터 보호를 위해 공유 캐시는 쓰지 않고 브라우저에만 잠깐 둔다
      "Cache-Control": "private, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
}
