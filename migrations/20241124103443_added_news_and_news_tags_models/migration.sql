-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "links" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "NewsTags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_NewsToNewsTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_NewsToNewsTags_A_fkey" FOREIGN KEY ("A") REFERENCES "News" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_NewsToNewsTags_B_fkey" FOREIGN KEY ("B") REFERENCES "NewsTags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_NewsToNewsTags_AB_unique" ON "_NewsToNewsTags"("A", "B");

-- CreateIndex
CREATE INDEX "_NewsToNewsTags_B_index" ON "_NewsToNewsTags"("B");
