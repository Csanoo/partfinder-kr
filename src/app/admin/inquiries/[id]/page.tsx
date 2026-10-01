import Link from "next/link";
import { notFound } from "next/navigation";
import { setInquiryStatusAction } from "@/app/admin/inquiries/actions";
import { INQUIRY_STATUS_LABEL, INQUIRY_TYPE_LABEL, ITEM_BUCKET_LABEL, NOTIFY_LABEL, PURCHASE_LABEL } from "@/components/admin/labels";
import { btnPrimary, Card } from "@/components/admin/ui";
import { TRAFFIC_LABEL, type TrafficSource } from "@/lib/attribution";
import { db } from "@/lib/db";
import { partPath } from "@/lib/parts/resolve-route";

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(d) : "-";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/** 문의 상세. 연락처·이메일은 메일 본문에 넣지 않고 이 화면에서만 확인한다 (docs/SPEC.md 6장) */
export default async function InquiryDetailPage(props: PageProps<"/admin/inquiries/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const q = await db().inquiry.findUnique({
    where: { id },
    include: {
      part: { select: { id: true, mpnDisplay: true, manufacturer: { select: { slug: true } }, slugs: { where: { isCanonical: true }, select: { slug: true }, take: 1 } } },
      searchLog: { select: { queryRaw: true, createdAt: true } },
    },
  });
  if (!q) notFound();
  const purged = q.personalDataPurgedAt != null;

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted">
        <Link href="/admin/inquiries" className="hover:underline">
          문의
        </Link>{" "}
        / {INQUIRY_TYPE_LABEL[q.type]} 문의
      </p>
      <h1 className="text-2xl font-bold">
        <span className="mpn">{q.mpn}</span> × {q.qty.toLocaleString("ko-KR")}
      </h1>

      <form action={setInquiryStatusAction.bind(null, q.id)} className="flex items-center gap-2">
        <select name="status" defaultValue={q.status} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          {Object.entries(INQUIRY_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className={btnPrimary}>상태 저장</button>
        <span className="text-xs text-muted">알림 메일: {NOTIFY_LABEL[q.notifyStatus]}</span>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="문의 내용">
          <dl>
            <Row label="접수">{fmt(q.createdAt)}</Row>
            <Row label="희망 납기">{q.dueDate ? q.dueDate.toISOString().slice(0, 10) : q.dueNegotiable ? "협의" : "-"}</Row>
            <Row label="이번 구매 품목 수">{ITEM_BUCKET_LABEL[q.itemCountBucket]}</Row>
            <Row label="구매 용도">{PURCHASE_LABEL[q.purchaseType]}</Row>
            <Row label="메모">{q.memo ? <span className="whitespace-pre-line">{q.memo}</span> : "-"}</Row>
          </dl>
        </Card>

        <Card title="연락처">
          {purged ? (
            <p className="text-sm text-muted">보유기간 경과로 개인정보를 파기했습니다 ({fmt(q.personalDataPurgedAt)}).</p>
          ) : (
            <dl>
              <Row label="회사명">{q.company ?? "-"}</Row>
              <Row label="담당자명">{q.contactName ?? "-"}</Row>
              <Row label="연락처">{q.phone ?? "-"}</Row>
              <Row label="이메일">{q.email ? <a href={`mailto:${q.email}`} className="text-brand-600 underline dark:text-brand-300">{q.email}</a> : "-"}</Row>
              <Row label="동의">
                개인정보 {q.consentPrivacy ? "동의" : "-"}
                {q.consentThirdParty != null && ` · 제3자 제공 ${q.consentThirdParty ? "동의" : "미동의"}`} · 문구 {q.consentTextVersion}
              </Row>
            </dl>
          )}
        </Card>

        <Card title="유입">
          <dl>
            <Row label="유입 경로">{q.trafficSource ? TRAFFIC_LABEL[q.trafficSource as TrafficSource] ?? q.trafficSource : "-"}</Row>
            <Row label="첫 방문">{fmt(q.firstVisitAt)}</Row>
            <Row label="랜딩 페이지">{q.landingUrl ?? "-"}</Row>
            <Row label="referrer">{q.referrer ?? "-"}</Row>
            <Row label="UTM">{[q.utmSource, q.utmMedium, q.utmCampaign].filter(Boolean).join(" / ") || "-"}</Row>
          </dl>
        </Card>

        <Card title="연결">
          <dl>
            <Row label="부품 페이지">
              {q.part && q.part.slugs[0] ? (
                <Link href={partPath(q.part.manufacturer.slug, q.part.slugs[0].slug)} className="mpn text-brand-600 underline dark:text-brand-300">
                  {q.part.mpnDisplay}
                </Link>
              ) : (
                "-"
              )}
            </Row>
            <Row label="검색">{q.searchLog ? `"${q.searchLog.queryRaw}" (${fmt(q.searchLog.createdAt)})` : "-"}</Row>
          </dl>
          {q.part && (
            <p className="mt-2 text-xs text-muted">
              FAQ 후보로 쓰려면{" "}
              <Link href={`/admin/parts/${q.part.id}`} className="underline">
                부품 편집
              </Link>
              에서 개인정보를 뺀 질문·답변으로 직접 추가하세요.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
