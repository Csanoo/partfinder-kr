import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 1대 배포용: .next/standalone 에 실행에 필요한 파일만 모은다 (deploy/README 참고)
  output: "standalone",
  poweredByHeader: false,
  // 부품 요청 BOM 첨부 (최대 5MB, src/lib/inquiry/validate.ts REQUEST_LIMITS) + multipart 여유분
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  /**
   * 한국어(기본 언어)는 주소에 접두어가 없다: /request → 내부적으로 app/[lang] 의 /ko/request.
   * 파일·정적 라우트(llms.txt, robots.txt, sitemap.xml 등)를 먼저 확인한 뒤, 동적 라우트([lang]) 전에 적용된다.
   * proxy 의 rewrite 대신 여기서 하는 이유: proxy rewrite 는 origin(프로토콜·호스트)을 비교해
   * 리버스 프록시(Caddy, X-Forwarded-Proto: https) 뒤에서 외부 요청으로 처리되어 500 이 났다.
   * 언어 접두어(en·ja·es·ko)와 api·admin·sitemaps·_next 는 제외.
   */
  async rewrites() {
    return [
      { source: "/", destination: "/ko" },
      { source: "/:path((?!(?:en|ja|es|ko|api|admin|sitemaps|_next)(?:/|$)).*)", destination: "/ko/:path" },
    ];
  },
};

export default nextConfig;
