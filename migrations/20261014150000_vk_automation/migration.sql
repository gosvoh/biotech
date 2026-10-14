ALTER TABLE "VkImportSource" ADD COLUMN "autoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VkImportSource" ADD COLUMN "autoRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VkImportSource" ADD COLUMN "automationLeaseRevision" INTEGER;
ALTER TABLE "VkImportSource" ADD COLUMN "nextNewAt" DATETIME;
ALTER TABLE "VkImportSource" ADD COLUMN "nextSyncAt" DATETIME;
ALTER TABLE "VkImportSource" ADD COLUMN "nextHistoryAt" DATETIME;
ALTER TABLE "VkImportSource" ADD COLUMN "lastAutomationError" TEXT;
CREATE TABLE "VkAutomationRuntime" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "currentGroupId" TEXT,
 "leaseToken" TEXT,
 "leaseUntil" DATETIME,
 "lastWorkerAt" DATETIME,
 "nextQueueAt" DATETIME,
 "lastError" TEXT
);
ALTER TABLE "VkAutomationRuntime" ADD COLUMN "lastHistoryId" TEXT;
