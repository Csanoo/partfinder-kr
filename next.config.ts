import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 1대 배포용: .next/standalone 에 실행에 필요한 파일만 모은다 (deploy/README 참고)
  output: "standalone",
  poweredByHeader: false,
  // 부품 요청 BOM 첨부 (최대 5MB, src/lib/inquiry/validate.ts REQUEST_LIMITS) + multipart 여유분
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
