-- CreateEnum
CREATE TYPE "FactStatus" AS ENUM ('pending', 'applied', 'dismissed', 'not_found', 'failed');

-- CreateTable
CREATE TABLE "manufacturer_fact" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "FactStatus" NOT NULL,
    "facts" JSONB,
    "message" TEXT,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manufacturer_fact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_fact_part_id_key" ON "manufacturer_fact"("part_id");

-- CreateIndex
CREATE INDEX "manufacturer_fact_status_idx" ON "manufacturer_fact"("status");

-- AddForeignKey
ALTER TABLE "manufacturer_fact" ADD CONSTRAINT "manufacturer_fact_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
