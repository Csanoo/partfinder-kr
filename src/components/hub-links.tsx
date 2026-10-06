import Link from "next/link";
import { db } from "@/lib/db";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

const LIMIT = 12;

interface HubLink {
  slug: string;
  label: string;
  count: number;
}

function Group({ title, base, items, locale }: { title: string; base: string; items: HubLink[]; locale: Locale }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-muted">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.slug}>
            <Link href={localePath(locale, `${base}/${i.slug}`)} className="inline-block rounded-md border border-line bg-surface px-2.5 py-1 text-sm hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-200">
              {i.label} <span className="text-muted">{i.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function loadLinks(locale: Locale): Promise<{ mfrs: HubLink[]; cats: HubLink[] }> {
  const [m, c] = await Promise.all([
    db().part.groupBy({ by: ["manufacturerId"], where: { pageStatus: "published" }, _count: { _all: true } }),
    db().part.groupBy({ by: ["categoryId"], where: { pageStatus: "published", categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const [mRows, cRows] = await Promise.all([
    db().manufacturer.findMany({ where: { id: { in: m.map((x) => x.manufacturerId) } }, select: { id: true, slug: true, nameEn: true } }),
    db().category.findMany({ where: { id: { in: c.map((x) => x.categoryId!) } }, select: { id: true, slug: true, nameKo: true, nameEn: true } }),
  ]);
  const top = (xs: HubLink[]) => xs.sort((a, b) => b.count - a.count).slice(0, LIMIT);
  return {
    mfrs: top(mRows.map((r) => ({ slug: r.slug, label: r.nameEn, count: m.find((x) => x.manufacturerId === r.id)!._count._all }))),
    cats: top(cRows.map((r) => ({ slug: r.slug, label: locale === "ko" ? r.nameKo : r.nameEn, count: c.find((x) => x.categoryId === r.id)!._count._all }))),
  };
}

/** 홈 내부 링크: 게시 부품이 있는 제조사·카테고리 허브 (부품 많은 순) */
export async function HubLinks({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).hub;
  let links: { mfrs: HubLink[]; cats: HubLink[] } = { mfrs: [], cats: [] };
  try {
    links = await loadLinks(locale);
  } catch (err) {
    // DB 장애 시에도 홈은 정상 표시
    console.error("[home] hub links failed:", err);
  }
  if (links.mfrs.length === 0 && links.cats.length === 0) return null;

  return (
    <section aria-labelledby="browse-heading" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="browse-heading" className="text-base font-bold">
          {t.browse}
        </h2>
        <Link href={localePath(locale, "/eol")} className="text-sm text-brand-600 hover:underline dark:text-brand-300">
          {t.eolLink}
        </Link>
      </div>
      <Group title={t.byManufacturer} base="/manufacturers" items={links.mfrs} locale={locale} />
      <Group title={t.byCategory} base="/categories" items={links.cats} locale={locale} />
    </section>
  );
}
