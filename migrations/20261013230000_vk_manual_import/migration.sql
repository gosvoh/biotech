ALTER TABLE "NewsImages" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "VkImportSource" (
    "groupId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "screenName" TEXT NOT NULL,
    "cursorDate" INTEGER,
    "lastAttemptAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "lastResult" JSONB,
    "needsRevalidate" BOOLEAN NOT NULL DEFAULT false,
    "leaseToken" TEXT,
    "leaseUntil" DATETIME
);
CREATE TABLE "VkImportPost" (
    "groupId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "newsId" TEXT,
    "status" TEXT NOT NULL,
    "snapshot" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    PRIMARY KEY ("groupId", "postId"),
    CONSTRAINT "VkImportPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VkImportSource" ("groupId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VkImportPost_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VkImportPost_newsId_key" ON "VkImportPost"("newsId");
CREATE INDEX "VkImportPost_groupId_status_idx" ON "VkImportPost"("groupId", "status");
