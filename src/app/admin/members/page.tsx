import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import MembersClient from "./page.client";

const getMembers = cache(
  () =>
    prisma.member.findMany({
      include: { disciplines: true, scientificWorks: true },
    }),
  ["members"],
  {
    revalidate: 60,
    tags: ["members"],
  }
);
const getDepartments = cache(
  () => prisma.department.findMany(),
  ["departments"],
  {
    revalidate: 60,
    tags: ["departments"],
  }
);
const getDisciplines = cache(
  () => prisma.discipline.findMany(),
  ["disciplines"],
  {
    revalidate: 60,
    tags: ["disciplines"],
  }
);
const getScientificWorks = cache(
  () => prisma.scientificWork.findMany(),
  ["scientificWorks"],
  {
    revalidate: 60,
    tags: ["scientificWorks"],
  }
);

export default async function Members() {
  const members = await getMembers();
  const departments = await getDepartments();
  const disciplines = await getDisciplines();
  const scientificWorks = await getScientificWorks();

  return (
    <main>
      <section>
        <div className="wrapper">
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
