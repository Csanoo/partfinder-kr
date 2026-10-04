import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityPanel } from "@/components/availability-panel";
import { PartDetail } from "@/components/part-detail";
import { loadPartById } from "@/lib/parts/load-page";
import { buildDescription, buildTitle } from "@/lib/parts/page-model";

/** 관리자 미리보기: 게시 전 상태도 공개 화면 그대로 확인 (색인 차단은 /admin 경로 전체에 적용) */
export default async function PreviewPage(props: PageProps<"/admin/parts/[id]/preview">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const part = await loadPartById(id);
  if (part == null) notFound();

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-brand-300 bg-brand-50 p-3 text-sm dark:border-brand-700 dark:bg-brand-900/30">
        <p className="font-semibold">미리보기 · {part.indexable ? "색인 대상" : "noindex"}</p>
        <p className="mpn mt-1 text-xs">title: {buildTitle(part)}</p>
        <p className="mt-1 text-xs">description: {buildDescription(part.summaryKo) || "(요약 없음)"}</p>
        <Link href={`/admin/parts/${id}`} className="mt-2 inline-block text-brand-700 underline dark:text-brand-300">
          편집으로 돌아가기
        </Link>
      </div>
      <PartDetail
        part={part}
        availability={<AvailabilityPanel mpn={part.mpnDisplay} />}
        sourcingForm={<p className="text-sm text-muted">(미리보기에서는 문의 폼을 표시하지 않습니다)</p>}
      />
    </div>
  );
}
