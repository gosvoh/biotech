import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import MembersClient from "./page.client";
import { connection } from "next/server";

async function getMembers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("members");
  return prisma.member.findMany({
    include: { disciplines: true, scientificWorks: true },
    orderBy: { lastName: "asc" },
  });
}

async function getDepartments() {
  "use cache";
  cacheLife("minutes");
  cacheTag("departments");
  return prisma.department.findMany();
}

async function getDisciplines() {
  "use cache";
  cacheLife("minutes");
  cacheTag("disciplines");
  return prisma.discipline.findMany();
}

async function getScientificWorks() {
  "use cache";
  cacheLife("minutes");
  cacheTag("scientificWorks");
  return prisma.scientificWork.findMany();
}

export default async function Members() {
  await connection();
  const members = await getMembers();
  const departments = await getDepartments();
  const disciplines = await getDisciplines();
  const scientificWorks = await getScientificWorks();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Члены команды</h1>
          <MembersClient
            members={members}
            departments={departments}
            disciplines={disciplines}
            scientificWorks={scientificWorks}
          />
        </div>
      </section>
    </main>
  );
}
