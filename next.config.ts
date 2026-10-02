import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 1대 배포용: .next/standalone 에 실행에 필요한 파일만 모은다 (deploy/README 참고)
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
