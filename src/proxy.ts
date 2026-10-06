import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { ATTRIBUTION_COOKIE, buildFirstTouch, encodeFirstTouch } from "@/lib/attribution";
import { isBot } from "@/lib/search/search-log";
import { db } from "@/lib/db";
import { resolvePartRoute } from "@/lib/parts/resolve-route";
import { prismaPartRouteRepo } from "@/lib/parts/service";
import { DEFAULT_LOCALE, localePath, splitLocale, type Locale } from "@/i18n/config";
import { LOCALE_HEADER, PATH_HEADER } from "@/i18n/headers";

export const SESSION_COOKIE = "pf_sid";
export const SESSION_HEADER = "x-pf-sid";

const PART_PATH = /^\/parts\/([^/]+)\/([^/]+)\/?$/;
const HUB_PATH = /^\/(manufacturers|categories)\/([^/]+)\/?$/;

export async function proxy(request: NextRequest) {
  // 관리자 화면: Basic Auth (docs/SPEC.md 8장)
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    if (verifyAdmin(request.headers.get("authorization")) == null) {
      return new NextResponse("인증이 필요합니다.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="MS admin", charset="UTF-8"', "X-Robots-Tag": "noindex" },
      });
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // 기본 언어(한국어)는 접두어 없이: /ko/... → /... 301
  if (request.nextUrl.pathname === `/${DEFAULT_LOCALE}` || request.nextUrl.pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 301);
  }
  const { locale, path } = splitLocale(request.nextUrl.pathname);

  // 허브 URL: slug 는 소문자만 정규 → 대소문자·끝 슬래시 차이는 301
  const hub = HUB_PATH.exec(path);
  if (hub) {
    const canonical = `/${hub[1]}/${hub[2].toLowerCase()}`;
    if (path !== canonical) {
      const url = request.nextUrl.clone();
      url.pathname = localePath(locale, canonical);
      return NextResponse.redirect(url, 301);
    }
  }

  // 부품 URL: 정규화 301, 비게시 410 (docs/SEO_SPEC.md 4장). Proxy는 Node.js 런타임이라 DB 조회 가능
  const m = PART_PATH.exec(path);
  if (m) {
    try {
      const r = await resolvePartRoute(m[1], m[2], prismaPartRouteRepo(db()));
      if (r.kind === "redirect") {
        const url = request.nextUrl.clone();
        url.pathname = localePath(locale, r.location);
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
  return withSession(request, locale, path);
}

/**
 * 익명 세션 쿠키 발급 (검색 로그의 session_id 용, 개인 식별 정보 아님).
 * 첫 요청에서도 서버 컴포넌트가 읽을 수 있도록 요청 헤더에도 넣어 전달한다.
 */
function withSession(request: NextRequest, locale: Locale, path: string) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  const sid = existing ?? crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set(SESSION_HEADER, sid);
  headers.set(LOCALE_HEADER, locale);
  headers.set(PATH_HEADER, path + request.nextUrl.search);
  // 공개 페이지는 모두 app/[lang] 아래: 접두어 없는 한국어 주소는 /ko 로 rewrite (주소창은 그대로)
  let response: NextResponse;
  if (locale === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${path === "/" ? "" : path}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  };
  if (!existing) response.cookies.set(SESSION_COOKIE, sid, cookieOpts);

  // 첫 방문 정보 (SEO_SPEC 8장): 외부에서 문서로 처음 들어온 요청에서 한 번만 기록. 사이트 내 이동(RSC)·프리페치·봇은 제외
  if (!request.cookies.has(ATTRIBUTION_COOKIE) && isDocumentRequest(request)) {
    const touch = buildFirstTouch(new URL(request.url), request.headers.get("referer"));
    response.cookies.set(ATTRIBUTION_COOKIE, encodeFirstTouch(touch), cookieOpts);
  }
  return response;
}

function isDocumentRequest(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return false;
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return false;
  return !isBot(request.headers.get("user-agent"));
}

const GONE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>더 이상 제공하지 않는 페이지</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>더 이상 제공하지 않는 부품 페이지입니다</h1>
<p><a href="/">부품 검색으로 이동</a></p></body></html>`;

export const config = {
  // 페이지 요청 전체 (정적 파일·_next·api 제외). 첫 방문 기록·세션·부품 URL 정규화·관리자 인증
  matcher: ["/((?!_next/|api/|.*\\.[a-z0-9]+$).*)"],
};
