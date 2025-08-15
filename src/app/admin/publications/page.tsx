import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/prisma";
import ProjectsClient from "./page.client";

export const getPublications = cache(
  () => prisma.publication.findMany(),
  ["publications"],
  {
    revalidate: 60,
    tags: ["publications"],
  }
);

export default async function Publications() {
  const publications = await getPublications();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Публикации</h1>
          <ProjectsClient publications={publications} />
        </div>
      </section>
    </main>
  );
}
