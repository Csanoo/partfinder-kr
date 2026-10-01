import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "pf_sid";
export const SESSION_HEADER = "x-pf-sid";

/**
 * 익명 세션 쿠키 발급 (검색 로그의 session_id 용, 개인 식별 정보 아님).
 * 첫 요청에서도 서버 컴포넌트가 읽을 수 있도록 요청 헤더에도 넣어 전달한다.
 */
export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/search", "/part/:path*"],
};
