import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { InquiryRepo } from "@/lib/inquiry/submit";
import type { SearchLogRepo } from "@/lib/search/search-log";

/** Prisma 기반 저장소. 로직 코드는 인터페이스에만 의존하고 테스트는 가짜 저장소를 쓴다. */

export const prismaSearchLogRepo: SearchLogRepo = {
  async create(record) {
    return db().searchLog.create({
      data: { ...record, resultCountByProvider: record.resultCountByProvider as Prisma.InputJsonValue },
      select: { id: true },
    });
  },
};

export const prismaInquiryRepo: InquiryRepo = {
  async create(data) {
    return db().inquiry.create({ data, select: { id: true } });
  },
};
