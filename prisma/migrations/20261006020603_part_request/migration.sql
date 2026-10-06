-- AlterEnum
ALTER TYPE "InquiryType" ADD VALUE 'request';

-- CreateTable
CREATE TABLE "inquiry_item" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "mpn" TEXT NOT NULL,
    "manufacturer" TEXT,
    "qty" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "inquiry_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_attachment" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiry_item_inquiry_id_idx" ON "inquiry_item"("inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_attachment_inquiry_id_idx" ON "inquiry_attachment"("inquiry_id");

-- AddForeignKey
ALTER TABLE "inquiry_item" ADD CONSTRAINT "inquiry_item_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_attachment" ADD CONSTRAINT "inquiry_attachment_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
