/*
  Warnings:

  - You are about to drop the column `name` on the `Discipline` table. All the data in the column will be lost.
  - Added the required column `title` to the `Discipline` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Discipline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL
);
INSERT INTO "new_Discipline" ("id") SELECT "id" FROM "Discipline";
DROP TABLE "Discipline";
ALTER TABLE "new_Discipline" RENAME TO "Discipline";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
