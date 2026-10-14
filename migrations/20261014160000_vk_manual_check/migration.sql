ALTER TABLE "VkImportSource" ADD COLUMN "manualCheckRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VkImportSource" ADD COLUMN "manualCheckAppliedRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VkImportSource" ADD COLUMN "nextManualCheckAt" DATETIME;
