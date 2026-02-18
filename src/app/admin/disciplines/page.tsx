import DisciplinesClient from "./page.client";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";

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
          <Suspense fallback={null}>
            <DisciplinesClient disciplines={disciplines} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
