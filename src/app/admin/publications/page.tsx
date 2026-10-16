import { requireAdminSectionPage } from "@/lib/admin-access.server";
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
  await requireAdminSectionPage("publications");
  const publications = await getPublications();

  return (
    <>
      <h1 className="text-2xl font-bold">
        Список публикаций в научных журналах
      </h1>
      <Suspense fallback={null}>
        <ProjectsClient publications={publications} />
      </Suspense>
    </>
  );
}
