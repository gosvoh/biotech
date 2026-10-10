-- Existing rows retain alphabetical order through the shared query fallback.
-- Adding a column leaves employees and their relation tables intact.
ALTER TABLE "Member" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
