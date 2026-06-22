import { prisma } from "@/prisma";
import { requireAdminPage } from "@/lib/utils.server";
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
  await requireAdminPage();
  const scientificWorks = await getScientificWorks();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Публикации</h1>
          <Suspense fallback={null}>
            <ScientificWorksClient scientificWorks={scientificWorks} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
