import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { slugKey } from "@/lib/parts/slug";

/**
 * 부품 상세 페이지 (자리표시).
 * 정규화 301·비게시 410은 proxy에서 처리한다. 화면 구성(SEO_SPEC 5.1)·메타·JSON-LD는 3단계에서 구현.
 * 그 전까지는 색인하지 않는다.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PartPage(props: PageProps<"/parts/[manufacturer]/[mpn]">) {
  const { manufacturer, mpn } = await props.params;
  const row = await db().partSlug.findFirst({
    where: { slugKey: slugKey(mpn), manufacturer: { slug: manufacturer }, part: { pageStatus: "published" } },
    select: { part: { select: { mpnDisplay: true, package: true, manufacturer: { select: { nameEn: true } } } } },
  });
  if (row == null) notFound();
  const { part } = row;

  return (
    <article className="space-y-2">
      <h1 className="text-2xl font-bold">
        <span className="mpn">{part.mpnDisplay}</span>{" "}
        <span className="text-lg font-normal text-muted">{part.manufacturer.nameEn}</span>
      </h1>
      <p className="text-sm text-muted">부품 상세 화면은 준비 중입니다. (SEO 명세 3단계)</p>
    </article>
  );
}
