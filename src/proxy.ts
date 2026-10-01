import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolvePartRoute } from "@/lib/parts/resolve-route";
import { prismaPartRouteRepo } from "@/lib/parts/service";

export const SESSION_COOKIE = "pf_sid";
export const SESSION_HEADER = "x-pf-sid";

const PART_PATH = /^\/parts\/([^/]+)\/([^/]+)\/?$/;

export async function proxy(request: NextRequest) {
  // 부품 URL: 정규화 301, 비게시 410 (docs/SEO_SPEC.md 4장). Proxy는 Node.js 런타임이라 DB 조회 가능
  const m = PART_PATH.exec(request.nextUrl.pathname);
  if (m) {
    try {
      const r = await resolvePartRoute(m[1], m[2], prismaPartRouteRepo(db()));
      if (r.kind === "redirect") {
        const url = request.nextUrl.clone();
        url.pathname = r.location;
        return NextResponse.redirect(url, 301);
      }
      if (r.kind === "gone") {
        return new NextResponse(GONE_HTML, {
          status: 410,
          headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
        });
      }
      // ok / not_found 는 페이지에서 처리 (not_found → notFound())
    } catch (err) {
      console.error("[proxy] part route resolve failed:", err);
    }
  }
  return withSession(request);
}

/**
 * 익명 세션 쿠키 발급 (검색 로그의 session_id 용, 개인 식별 정보 아님).
 * 첫 요청에서도 서버 컴포넌트가 읽을 수 있도록 요청 헤더에도 넣어 전달한다.
 */
function withSession(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  const sid = existing ?? crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set(SESSION_HEADER, sid);
  const response = NextResponse.next({ request: { headers } });

  if (!existing) {
    response.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

const GONE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>더 이상 제공하지 않는 페이지</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>더 이상 제공하지 않는 부품 페이지입니다</h1>
<p><a href="/">부품 검색으로 이동</a></p></body></html>`;

export const config = {
  matcher: ["/search", "/parts/:path*"],
};
