import { timingSafeEqual } from "node:crypto";

/**
 * 관리자 단순 인증 (HTTP Basic Auth). docs/SPEC.md 8장.
 * ADMIN_USERNAME / ADMIN_PASSWORD 환경변수가 없으면 관리자 화면은 항상 거부된다.
 * TODO(확인필요): 관리자 여러 명 / 감사 로그가 필요해지면 계정 테이블로 교체
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Authorization 헤더를 검증하고, 통과하면 관리자 이름을 돌려준다. */
export function verifyAdmin(authorization: string | null): string | null {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || !authorization?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  const okUser = safeEqual(decoded.slice(0, i), user);
  const okPass = safeEqual(decoded.slice(i + 1), pass);
  return okUser && okPass ? user : null;
}

/** 서버 액션 안에서 다시 확인 (proxy 외 이중 방어) */
export async function requireAdmin(): Promise<string> {
  const { headers } = await import("next/headers");
  const name = verifyAdmin((await headers()).get("authorization"));
  if (name == null) throw new Error("unauthorized");
  return name;
}
