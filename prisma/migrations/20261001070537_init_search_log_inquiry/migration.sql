-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('quote', 'sourcing');

-- CreateEnum
CREATE TYPE "ItemCountBucket" AS ENUM ('one', 'two_to_ten', 'eleven_plus');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('company', 'personal');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('new', 'contacted', 'quoted', 'won', 'lost');

-- CreateEnum
CREATE TYPE "NotifyStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "search_log" (
    "id" UUID NOT NULL,
    "query_raw" TEXT NOT NULL,
    "query_normalized" TEXT NOT NULL,
    "qty" INTEGER,
    "result_count_by_provider" JSONB NOT NULL,
    "has_any_stock" BOOLEAN NOT NULL,
    "session_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'search',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry" (
    "id" UUID NOT NULL,
    "type" "InquiryType" NOT NULL,
    "mpn" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "due_date" DATE,
    "due_negotiable" BOOLEAN NOT NULL DEFAULT false,
    "item_count_bucket" "ItemCountBucket" NOT NULL,
    "purchase_type" "PurchaseType" NOT NULL,
    "company" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "memo" TEXT,
    "consent_privacy" BOOLEAN NOT NULL,
    "consent_third_party" BOOLEAN,
    "consent_text_version" TEXT NOT NULL,
    "search_log_id" UUID,
    "status" "InquiryStatus" NOT NULL DEFAULT 'new',
    "notify_status" "NotifyStatus" NOT NULL DEFAULT 'pending',
    "personal_data_purged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_log_created_at_idx" ON "search_log"("created_at");

-- CreateIndex
CREATE INDEX "search_log_query_normalized_idx" ON "search_log"("query_normalized");

-- CreateIndex
CREATE INDEX "inquiry_created_at_idx" ON "inquiry"("created_at");

-- CreateIndex
CREATE INDEX "inquiry_type_status_idx" ON "inquiry"("type", "status");

-- CreateIndex
CREATE INDEX "inquiry_notify_status_idx" ON "inquiry"("notify_status");

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_search_log_id_fkey" FOREIGN KEY ("search_log_id") REFERENCES "search_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;
