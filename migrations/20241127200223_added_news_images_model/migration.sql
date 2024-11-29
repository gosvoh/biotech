-- CreateTable
CREATE TABLE "NewsImages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsId" TEXT NOT NULL,
    CONSTRAINT "NewsImages_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
