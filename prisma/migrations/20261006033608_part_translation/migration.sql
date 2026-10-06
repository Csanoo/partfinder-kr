-- CreateTable
CREATE TABLE "part_translation" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "summary" TEXT,
    "specs" JSONB NOT NULL DEFAULT '[]',
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "alt_notes" JSONB NOT NULL DEFAULT '{}',
    "source_hash" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'machine',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "part_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_translation_part_id_locale_key" ON "part_translation"("part_id", "locale");

-- AddForeignKey
ALTER TABLE "part_translation" ADD CONSTRAINT "part_translation_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
