-- Retain User rows, IDs, existing values and references in place.
ALTER TABLE "User" ADD COLUMN "accessStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "User" ADD COLUMN "accessRevision" INTEGER NOT NULL DEFAULT 0;
-- Only accounts present at upgrade are automatically approved.
UPDATE "User" SET "accessStatus" = 'active';

-- Existing links remain compatible with the initial access revision.
ALTER TABLE "VerificationToken" ADD COLUMN "accessRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UserSectionPermission" (
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    CONSTRAINT "UserSectionPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserSectionPermission_userId_section_key" ON "UserSectionPermission"("userId", "section");

CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
