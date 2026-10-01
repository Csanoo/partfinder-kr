-- CreateEnum
CREATE TYPE "PartLifecycle" AS ENUM ('active', 'nrnd', 'ltb', 'eol', 'unknown');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('draft', 'review', 'published', 'unpublished');

-- CreateEnum
CREATE TYPE "AltRelation" AS ENUM ('drop_in', 'similar', 'upgrade');

-- CreateEnum
CREATE TYPE "FaqSource" AS ENUM ('inquiry', 'manual');

-- CreateTable
CREATE TABLE "manufacturer" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ko" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ko" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part" (
    "id" UUID NOT NULL,
    "mpn_display" TEXT NOT NULL,
    "mpn_key" TEXT NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "category_id" UUID,
    "package" TEXT,
    "summary_ko" TEXT,
    "key_specs" JSONB NOT NULL DEFAULT '[]',
    "lifecycle_status" "PartLifecycle" NOT NULL DEFAULT 'unknown',
    "lifecycle_checked_at" TIMESTAMPTZ(3),
    "lifecycle_source" TEXT,
    "eol_date" DATE,
    "datasheet_url" TEXT,
    "page_status" "PageStatus" NOT NULL DEFAULT 'draft',
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "content_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_slug" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "slug_key" TEXT NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_slug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_variant" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "mpn_variant" TEXT NOT NULL,
    "mpn_variant_key" TEXT NOT NULL,
    "variant_slug_key" TEXT NOT NULL,

    CONSTRAINT "part_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_alternative" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "alt_part_id" UUID,
    "alt_mpn_text" TEXT,
    "relation" "AltRelation" NOT NULL,
    "note_ko" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_alternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_faq" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "question_ko" TEXT NOT NULL,
    "answer_ko" TEXT NOT NULL,
    "source" "FaqSource" NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "source_inquiry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "part_faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_slug_key" ON "manufacturer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "part_page_status_indexable_idx" ON "part"("page_status", "indexable");

-- CreateIndex
CREATE INDEX "part_category_id_idx" ON "part"("category_id");

-- CreateIndex
CREATE INDEX "part_lifecycle_status_idx" ON "part"("lifecycle_status");

-- CreateIndex
CREATE UNIQUE INDEX "part_manufacturer_id_mpn_key_key" ON "part"("manufacturer_id", "mpn_key");

-- CreateIndex
CREATE INDEX "part_slug_part_id_idx" ON "part_slug"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "part_slug_manufacturer_id_slug_key_key" ON "part_slug"("manufacturer_id", "slug_key");

-- CreateIndex
CREATE UNIQUE INDEX "part_slug_manufacturer_id_slug_key" ON "part_slug"("manufacturer_id", "slug");

-- CreateIndex
CREATE INDEX "part_variant_part_id_idx" ON "part_variant"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "part_variant_manufacturer_id_mpn_variant_key_key" ON "part_variant"("manufacturer_id", "mpn_variant_key");

-- CreateIndex
CREATE UNIQUE INDEX "part_variant_manufacturer_id_variant_slug_key_key" ON "part_variant"("manufacturer_id", "variant_slug_key");

-- CreateIndex
CREATE INDEX "part_alternative_part_id_idx" ON "part_alternative"("part_id");

-- CreateIndex
CREATE INDEX "part_faq_part_id_published_idx" ON "part_faq"("part_id", "published");

-- AddForeignKey
ALTER TABLE "part" ADD CONSTRAINT "part_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part" ADD CONSTRAINT "part_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_slug" ADD CONSTRAINT "part_slug_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_slug" ADD CONSTRAINT "part_slug_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_variant" ADD CONSTRAINT "part_variant_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_variant" ADD CONSTRAINT "part_variant_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_alternative" ADD CONSTRAINT "part_alternative_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_alternative" ADD CONSTRAINT "part_alternative_alt_part_id_fkey" FOREIGN KEY ("alt_part_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_faq" ADD CONSTRAINT "part_faq_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
