import { createTaxonomyAction } from "@/app/admin/parts/actions";
import { btnSecondary, Card, first, inputCls, Notice } from "@/components/admin/ui";
import { db } from "@/lib/db";

export default async function TaxonomyPage(props: PageProps<"/admin/taxonomy">) {
  const sp = await props.searchParams;
  const [manufacturers, categories] = await Promise.all([
    db().manufacturer.findMany({ orderBy: { nameEn: "asc" }, include: { _count: { select: { parts: true } } } }),
    db().category.findMany({ orderBy: { nameKo: "asc" }, include: { _count: { select: { parts: true } } } }),
  ]);

  const sections = [
    { kind: "manufacturer" as const, title: "제조사", rows: manufacturers, example: "Texas Instruments / 텍사스 인스트루먼트" },
    { kind: "category" as const, title: "카테고리", rows: categories, example: "Amplifiers / 증폭기" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">제조사·카테고리</h1>
      <Notice error={first(sp.error)} message={first(sp.message)} />
      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.kind} title={`${s.title} (${s.rows.length})`}>
            <form action={createTaxonomyAction.bind(null, s.kind)} className="mb-4 grid gap-2 sm:grid-cols-2">
              <input name="nameEn" placeholder="영문명 (필수)" required className={inputCls} />
              <input name="nameKo" placeholder="한글명" className={inputCls} />
              <input name="slug" placeholder="slug (비우면 영문명으로 자동)" className={`${inputCls} mpn`} />
              <button className={btnSecondary}>추가</button>
              <p className="text-xs text-muted sm:col-span-2">예: {s.example}. slug는 URL에 쓰이므로 나중에 바꾸지 않는 것이 좋습니다.</p>
            </form>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-medium">slug</th>
                  <th className="py-1 font-medium">영문명</th>
                  <th className="py-1 font-medium">한글명</th>
                  <th className="py-1 text-right font-medium">부품</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="mpn py-1.5 text-xs">{r.slug}</td>
                    <td className="py-1.5">{r.nameEn}</td>
                    <td className="py-1.5">{r.nameKo}</td>
                    <td className="py-1.5 text-right">{r._count.parts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
