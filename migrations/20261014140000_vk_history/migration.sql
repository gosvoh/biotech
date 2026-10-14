ALTER TABLE "VkImportSource" ADD COLUMN "tagRecheckAppliedRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VkImportSource" ADD COLUMN "lastTagRecheckAt" DATETIME;
ALTER TABLE "VkImportSource" ADD COLUMN "lastTagRecheckError" TEXT;
ALTER TABLE "VkImportSource" ADD COLUMN "lastTagRecheckResult" JSONB;
CREATE TABLE "VkImportTagCatalog" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1, "revision" INTEGER NOT NULL DEFAULT 0, "lastAttemptAt" DATETIME, "lastError" TEXT);
CREATE TABLE "VkHistoryJob" (
 "id" TEXT NOT NULL PRIMARY KEY, "groupId" TEXT NOT NULL, "initialKey" TEXT, "activeKey" TEXT,
 "from" TEXT NOT NULL, "to" TEXT NOT NULL, "initial" BOOLEAN NOT NULL DEFAULT false,
 "state" TEXT NOT NULL DEFAULT 'queued', "scanOffset" INTEGER NOT NULL DEFAULT 0, "scanCount" INTEGER,
 "anchorDate" INTEGER, "anchorPostId" TEXT, "exhausted" BOOLEAN NOT NULL DEFAULT false,
 "lastSuccessAt" DATETIME, "error" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "VkHistoryJob_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VkImportSource"("groupId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VkHistoryJob_initialKey_key" ON "VkHistoryJob"("initialKey");
CREATE UNIQUE INDEX "VkHistoryJob_activeKey_key" ON "VkHistoryJob"("activeKey");
CREATE INDEX "VkHistoryJob_groupId_state_idx" ON "VkHistoryJob"("groupId", "state");
CREATE TABLE "VkHistoryPost" (
 "jobId" TEXT NOT NULL, "postId" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'pending', "outcome" TEXT, "wasImported" BOOLEAN NOT NULL DEFAULT false,
 "attempts" INTEGER NOT NULL DEFAULT 0, "error" TEXT,
 PRIMARY KEY ("jobId", "postId"),
 CONSTRAINT "VkHistoryPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VkHistoryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VkHistoryPost_jobId_state_idx" ON "VkHistoryPost"("jobId", "state");
