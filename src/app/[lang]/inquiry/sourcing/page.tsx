import { redirect } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";

/** 예전 주소: 견적·소싱 문의는 부품 요청 하나로 통합됨 → /request 로 보낸다 (품번·수량 유지) */
export default async function LegacyInquiryPage(props: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang } = await props.params;
  const target = localePath(hasLocale(lang) ? lang : "ko", "/request");
  const sp = await props.searchParams;
  const params = new URLSearchParams();
  for (const k of ["mpn", "qty", "sl"]) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) params.set(k, s);
  }
  const q = params.toString();
  redirect(q ? `${target}?${q}` : target);
}
