-- Preserve existing names and relations, including legacy duplicates.
-- Validated writes claim a unique lower-case name; untouched legacy rows stay NULL.
ALTER TABLE "NewsTags" ADD COLUMN "normalizedTitle" TEXT;
CREATE UNIQUE INDEX "NewsTags_normalizedTitle_key" ON "NewsTags"("normalizedTitle");
