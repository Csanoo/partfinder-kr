import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

const nav = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/inquiries", label: "문의" },
  { href: "/admin/seo", label: "SEO 지표" },
  { href: "/admin/parts", label: "부품" },
  { href: "/admin/parts/new", label: "부품 등록" },
  { href: "/admin/parts/import", label: "CSV 가져오기" },
  { href: "/admin/facts", label: "제조사 정보 검토" },
  { href: "/admin/taxonomy", label: "제조사·카테고리" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1 border-b border-line pb-3">
        <span className="mr-2 rounded bg-copper-500 px-2 py-0.5 text-xs font-bold text-white">ADMIN</span>
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40"
          >
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
