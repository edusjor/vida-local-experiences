-- Add slug column to Tour
ALTER TABLE "Tour" ADD COLUMN "slug" TEXT;

-- Generar slug solo con lower y regexp_replace (sin quitar tildes, eso lo hace el backend)
UPDATE "Tour" SET "slug" = lower(regexp_replace("title", '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL;

ALTER TABLE "Tour" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");
