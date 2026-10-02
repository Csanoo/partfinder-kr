-- AlterTable
ALTER TABLE "part" ADD COLUMN     "summary_draft_at" TIMESTAMPTZ(3),
ADD COLUMN     "summary_draft_ko" TEXT;
