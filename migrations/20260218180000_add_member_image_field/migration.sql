-- AlterTable
ALTER TABLE "Member" ADD COLUMN "image" TEXT;

-- Backfill existing rows to preserve current file mapping
UPDATE "Member" SET "image" = "id" WHERE "image" IS NULL;
