import Link from "next/link";
import { setInquiryStatusAction } from "@/app/admin/inquiries/actions";
import { INQUIRY_STATUS_LABEL, INQUIRY_TYPE_LABEL, ITEM_BUCKET_LABEL, NOTIFY_LABEL, PURCHASE_LABEL } from "@/components/admin/labels";
import { btnSecondary, first, inputCls } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import type { InquiryStatus, InquiryType, NotifyStatus } from "@/generated/prisma/enums";
import { TRAFFIC_LABEL, type TrafficSource } from "@/lib/attribution";
import { db } from "@/lib/db";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export default async function InquiriesPage(props: PageProps<"/admin/inquiries">) {
  const sp = await props.searchParams;
  const type = first(sp.type);
  const status = first(sp.status);
  const notify = first(sp.notify);

  const where: Prisma.InquiryWhereInput = {
    ...(INQUIRY_TYPE_LABEL[type] ? { type: type as InquiryType } : {}),
    ...(INQUIRY_STATUS_LABEL[status] ? { status: status as InquiryStatus } : {}),
    ...(NOTIFY_LABEL[notify] ? { notifyStatus: notify as NotifyStatus } : {}),
  };
  const [rows, newCount] = await Promise.all([
    db().inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        mpn: true,
        qty: true,
        itemCountBucket: true,
        purchaseType: true,
        company: true,
        status: true,
        notifyStatus: true,
        trafficSource: true,
        createdAt: true,
        part: { select: { mpnDisplay: true } },
      },
    }),
    db().inquiry.count({ where: { status: "new" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold">
          문의 <span className="ml-2 rounded-full bg-copper-500 px-2.5 py-0.5 text-sm text-white">신규 {newCount}</span>
        </h1>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
        <select name="type" defaultValue={type} className={`${inputCls} w-32`}>
          <option value="">종류 전체</option>
          {Object.entries(INQUIRY_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={`${inputCls} w-32`}>
          <option value="">상태 전체</option>
          {Object.entries(INQUIRY_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="notify" defaultValue={notify} className={`${inputCls} w-36`}>
          <option value="">알림 전체</option>
          {Object.entries(NOTIFY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              알림 {v}
            </option>
          ))}
        </select>
        <button className={btnSecondary}>필터</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">접수</th>
              <th className="px-3 py-2 font-medium">종류</th>
              <th className="px-3 py-2 font-medium">품번 × 수량</th>
              <th className="px-3 py-2 font-medium">품목 수</th>
              <th className="px-3 py-2 font-medium">용도</th>
              <th className="px-3 py-2 font-medium">유입</th>
              <th className="px-3 py-2 font-medium">알림</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  문의가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-line ${r.status === "new" ? "bg-copper-50/50 dark:bg-copper-700/10" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{fmt(r.createdAt)}</td>
                <td className="px-3 py-2">{INQUIRY_TYPE_LABEL[r.type]}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/inquiries/${r.id}`} className="mpn font-medium text-brand-700 hover:underline dark:text-brand-300">
                    {r.mpn}
                  </Link>{" "}
                  × {r.qty.toLocaleString("ko-KR")}
                  {r.part && <span className="ml-1 rounded bg-brand-50 px-1 text-[11px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">부품 페이지</span>}
                </td>
                <td className="px-3 py-2">{ITEM_BUCKET_LABEL[r.itemCountBucket]}</td>
                <td className="px-3 py-2">
                  {PURCHASE_LABEL[r.purchaseType]}
                  {r.company && <span className="block text-xs text-muted">{r.company}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{r.trafficSource ? TRAFFIC_LABEL[r.trafficSource as TrafficSource] ?? r.trafficSource : "-"}</td>
                <td className={`px-3 py-2 text-xs ${r.notifyStatus === "failed" ? "font-semibold text-red-600" : "text-muted"}`}>{NOTIFY_LABEL[r.notifyStatus]}</td>
                <td className="px-3 py-2">
                  <form action={setInquiryStatusAction.bind(null, r.id)} className="flex gap-1">
                    <select name="status" defaultValue={r.status} className="rounded border border-line bg-surface px-1 py-0.5 text-xs">
                      {Object.entries(INQUIRY_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button className="rounded border border-line px-2 text-xs hover:bg-brand-50 dark:hover:bg-brand-900/30">저장</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
