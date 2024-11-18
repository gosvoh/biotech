-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScientificWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_MemberToScientificWork" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MemberToScientificWork_A_fkey" FOREIGN KEY ("A") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MemberToScientificWork_B_fkey" FOREIGN KEY ("B") REFERENCES "ScientificWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DisciplineToMember" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DisciplineToMember_A_fkey" FOREIGN KEY ("A") REFERENCES "Discipline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DisciplineToMember_B_fkey" FOREIGN KEY ("B") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_MemberToScientificWork_AB_unique" ON "_MemberToScientificWork"("A", "B");

-- CreateIndex
CREATE INDEX "_MemberToScientificWork_B_index" ON "_MemberToScientificWork"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DisciplineToMember_AB_unique" ON "_DisciplineToMember"("A", "B");

-- CreateIndex
CREATE INDEX "_DisciplineToMember_B_index" ON "_DisciplineToMember"("B");
