import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import ScientificWorksClient from "./page.client";
import { Suspense } from "react";

async function getScientificWorks() {
  "use cache";
  cacheLife("minutes");
  cacheTag("scientificWorks");
  return prisma.scientificWork.findMany();
}

export default async function ScientificWorks() {
  const scientificWorks = await getScientificWorks();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Научные работы</h1>
          <Suspense fallback={null}>
            <ScientificWorksClient scientificWorks={scientificWorks} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
