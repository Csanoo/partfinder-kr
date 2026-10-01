-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN     "first_visit_at" TIMESTAMPTZ(3),
ADD COLUMN     "landing_url" TEXT,
ADD COLUMN     "part_id" UUID,
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "traffic_source" TEXT,
ADD COLUMN     "utm_campaign" TEXT,
ADD COLUMN     "utm_medium" TEXT,
ADD COLUMN     "utm_source" TEXT;

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "part_id" UUID,
    "session_id" TEXT,
    "path" TEXT,
    "traffic_source" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_snapshot" (
    "day" DATE NOT NULL,
    "published_parts" INTEGER NOT NULL,
    "indexable_parts" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "index_snapshot_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "event_type_created_at_idx" ON "event"("type", "created_at");

-- CreateIndex
CREATE INDEX "event_part_id_type_idx" ON "event"("part_id", "type");

-- CreateIndex
CREATE INDEX "inquiry_part_id_idx" ON "inquiry"("part_id");

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
