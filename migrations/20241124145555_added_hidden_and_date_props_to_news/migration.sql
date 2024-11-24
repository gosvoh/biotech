/*
  Warnings:

  - Added the required column `date` to the `News` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "links" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "date" TEXT NOT NULL
);
INSERT INTO "new_News" ("id", "links", "text", "title") SELECT "id", "links", "text", "title" FROM "News";
DROP TABLE "News";
ALTER TABLE "new_News" RENAME TO "News";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
