import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import ScientificWorksClient from "./page.client";

const getScientificWorks = cache(
  () => prisma.scientificWork.findMany(),
  ["scientificWorks"],
  {
    revalidate: 60,
    tags: ["scientificWorks"],
  }
);

export default async function ScientificWorks() {
  const scientificWorks = await getScientificWorks();

  return (
    <main>
      <section>
        <div className="wrapper">
          <ScientificWorksClient scientificWorks={scientificWorks} />
        </div>
      </section>
    </main>
  );
}
