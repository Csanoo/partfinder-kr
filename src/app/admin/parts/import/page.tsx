import Link from "next/link";
import { ImportForm } from "@/components/admin/import-form";
import { MAX_IMPORT_ROWS } from "@/lib/parts/import-plan";

export default function ImportPage() {
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold">CSV 가져오기</h1>
      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            필수 열: <code className="mpn">mpn</code>, <code className="mpn">manufacturer</code>. 선택: category, package,
            lifecycle_status, eol_date, lifecycle_checked_at, lifecycle_source, datasheet_url (한글 헤더도 가능)
          </li>
          <li>가져온 부품은 모두 초안(draft)으로 만들어집니다. 이미 등록된 품번은 건너뜁니다.</li>
          <li>카테고리는 미리 등록된 것만 쓸 수 있습니다. 새 제조사는 영문명이면 자동으로 만들어집니다.</li>
          <li>한 번에 최대 {MAX_IMPORT_ROWS}행. 먼저 검증 결과를 보고, 문제가 없을 때 가져오기를 실행합니다.</li>
        </ul>
        <Link
          href="/admin/parts/import/template"
          prefetch={false}
          className="mt-3 inline-block text-brand-600 hover:underline dark:text-brand-300"
        >
          CSV 템플릿 내려받기 ↓
        </Link>
      </div>
      <ImportForm />
    </div>
  );
}
