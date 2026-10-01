import Link from "next/link";
import { db } from "@/lib/db";

const LIMIT = 12;

interface HubLink {
  slug: string;
  label: string;
  count: number;
}

function Group({ title, base, items }: { title: string; base: string; items: HubLink[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.slug}>
            <Link href={`${base}/${i.slug}`} className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand-400">
              {i.label} <span className="text-muted">{i.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function loadLinks(): Promise<{ mfrs: HubLink[]; cats: HubLink[] }> {
  const [m, c] = await Promise.all([
    db().part.groupBy({ by: ["manufacturerId"], where: { pageStatus: "published" }, _count: { _all: true } }),
    db().part.groupBy({ by: ["categoryId"], where: { pageStatus: "published", categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const [mRows, cRows] = await Promise.all([
    db().manufacturer.findMany({ where: { id: { in: m.map((x) => x.manufacturerId) } }, select: { id: true, slug: true, nameEn: true } }),
    db().category.findMany({ where: { id: { in: c.map((x) => x.categoryId!) } }, select: { id: true, slug: true, nameKo: true } }),
  ]);
  const top = (xs: HubLink[]) => xs.sort((a, b) => b.count - a.count).slice(0, LIMIT);
  return {
    mfrs: top(mRows.map((r) => ({ slug: r.slug, label: r.nameEn, count: m.find((x) => x.manufacturerId === r.id)!._count._all }))),
    cats: top(cRows.map((r) => ({ slug: r.slug, label: r.nameKo, count: c.find((x) => x.categoryId === r.id)!._count._all }))),
  };
}

/** 홈 내부 링크: 게시 부품이 있는 제조사·카테고리 허브 (부품 많은 순) */
export async function HubLinks() {
  let links: { mfrs: HubLink[]; cats: HubLink[] } = { mfrs: [], cats: [] };
  try {
    links = await loadLinks();
  } catch (err) {
    // DB 장애 시에도 홈은 정상 표시
    console.error("[home] hub links failed:", err);
  }
  if (links.mfrs.length === 0 && links.cats.length === 0) return null;

  return (
    <section aria-labelledby="browse-heading" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="browse-heading" className="text-xl font-bold">
          부품 둘러보기
        </h2>
        <Link href="/eol" className="text-sm text-brand-600 hover:underline dark:text-brand-300">
          단종·수급 주의 부품 목록 →
        </Link>
      </div>
      <Group title="제조사별" base="/manufacturers" items={links.mfrs} />
      <Group title="카테고리별" base="/categories" items={links.cats} />
    </section>
  );
}
