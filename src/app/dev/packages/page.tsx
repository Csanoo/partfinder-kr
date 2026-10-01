import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageFigure } from "@/components/package-illustration";
import { parsePackage } from "@/lib/package/parse-package";

export const metadata: Metadata = { title: "패키지 일러스트 (개발용)", robots: { index: false, follow: false } };

const SAMPLES = [
  "SOIC-8",
  "SOIC-16",
  "TSSOP-20",
  "PDIP-8",
  "DIP-16",
  "LQFP-48",
  "LQFP-100",
  "QFN-32",
  "DFN-8",
  "SOT-23",
  "SOT-23-5",
  "SOT-23-6",
  "SOT-223",
  "TO-220",
  "TO-92",
  "FBGA-256",
  "0603",
  "알 수 없음",
];

/** 개발 환경에서만 보이는 일러스트 확인 페이지. */
export default function PackagesDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">패키지 일러스트</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {SAMPLES.map((s) => (
          <PackageFigure key={s} info={parsePackage(s)} size={120} />
        ))}
      </div>
    </div>
  );
}
