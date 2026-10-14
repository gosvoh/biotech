ALTER TABLE "VkImportSource" ADD COLUMN "revalidationRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VkImportPost" ADD COLUMN "deletionRetry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VkImportPost" ADD COLUMN "deletionRetryAt" DATETIME;
