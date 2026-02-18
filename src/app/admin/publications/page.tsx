import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/prisma";
import ProjectsClient from "./page.client";
import { Suspense } from "react";

export async function getPublications() {
  "use cache";
  cacheLife("minutes");
  cacheTag("publications");
  return prisma.publication.findMany();
}

export default async function Publications() {
  const publications = await getPublications();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Публикации</h1>
          <Suspense fallback={null}>
            <ProjectsClient publications={publications} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
