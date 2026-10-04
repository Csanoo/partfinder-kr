import Link from "next/link";
import { createPartAction } from "@/app/admin/parts/actions";
import { btnPrimary, Field, first, inputCls, Notice } from "@/components/admin/ui";
import { db } from "@/lib/db";

export default async function NewPartPage(props: PageProps<"/admin/parts/new">) {
  const sp = await props.searchParams;
  const [manufacturers, categories] = await Promise.all([
    db().manufacturer.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameKo: true } }),
    db().category.findMany({ orderBy: { nameKo: "asc" }, select: { id: true, nameKo: true } }),
  ]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">부품 등록</h1>
      <p className="text-sm text-muted">초안(draft)으로 만들어지고, 다음 화면에서 내용을 채운 뒤 검토·게시합니다.</p>
      <Notice error={first(sp.error)} />
      {manufacturers.length === 0 ? (
        <p className="text-sm">
          먼저{" "}
          <Link href="/admin/taxonomy" className="text-brand-600 underline">
            제조사를 등록
          </Link>
          해 주세요.
        </p>
      ) : (
        <form action={createPartAction} className="space-y-4 rounded-md border border-line bg-surface p-5">
          <Field label="품번 (원본 표기 그대로)" hint="대소문자·공백·하이픈만 다른 품번은 같은 부품으로 봅니다.">
            <input name="mpnDisplay" required className={`${inputCls} mpn`} />
          </Field>
          <Field label="제조사">
            <select name="manufacturerId" required className={inputCls}>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameEn} ({m.nameKo})
                </option>
              ))}
            </select>
          </Field>
          <Field label="카테고리">
            <select name="categoryId" className={inputCls}>
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameKo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="패키지" hint="예: SOIC-8, LQFP-48">
            <input name="package" className={inputCls} />
          </Field>
          <button className={btnPrimary}>초안 만들기</button>
        </form>
      )}
    </div>
  );
}
