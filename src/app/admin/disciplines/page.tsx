import DisciplinesClient from "./page.client";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";

async function getDisciplines() {
  "use cache";
  cacheLife("minutes");
  cacheTag("disciplines");
  return prisma.discipline.findMany();
}

export default async function Disciplines() {
  const disciplines = await getDisciplines();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Дисциплины</h1>
          <DisciplinesClient disciplines={disciplines} />
        </div>
      </section>
    </main>
  );
}
