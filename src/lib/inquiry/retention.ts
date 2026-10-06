import { db } from "@/lib/db";

/**
 * 개인정보 보유기간 경과 문의의 개인정보 파기 (docs/SPEC.md 7장: 배치 작업 훅).
 * 보유기간은 미정이라 PERSONAL_DATA_RETENTION_DAYS 가 없으면 아무것도 지우지 않는다.
 * TODO(확인필요): 보유기간 값, 실행 주기(스케줄러)
 */
export function retentionDays(): number | null {
  const v = Number(process.env.PERSONAL_DATA_RETENTION_DAYS);
  return Number.isInteger(v) && v > 0 ? v : null;
}

export async function purgeExpiredPersonalData(now = new Date()): Promise<{ purged: number; skipped?: string }> {
  const days = retentionDays();
  if (days == null) return { purged: 0, skipped: "PERSONAL_DATA_RETENTION_DAYS 미설정" };
  const before = new Date(now.getTime() - days * 86_400_000);
  // 첨부 파일(BOM 등)에는 회사·담당자 정보가 섞일 수 있어 통째로 삭제한다
  await db().inquiryAttachment.deleteMany({ where: { inquiry: { createdAt: { lt: before } } } });
  const r = await db().inquiry.updateMany({
    where: { createdAt: { lt: before }, personalDataPurgedAt: null },
    // 수요 통계(품번·수량·품목 수·용도·유입)는 남기고 사람을 식별할 수 있는 값만 지운다
    data: { contactName: null, phone: null, email: null, company: null, memo: null, personalDataPurgedAt: now },
  });
  return { purged: r.count };
}
