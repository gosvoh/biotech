import DisciplinesClient from "./page.client";
import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";

const getDisciplines = cache(
  () => prisma.discipline.findMany(),
  ["disciplines"],
  {
    revalidate: 60,
    tags: ["disciplines"],
  }
);

export default async function Disciplines() {
  const disciplines = await getDisciplines();

  return (
    <main>
      <section>
        <div className="wrapper">
          <DisciplinesClient disciplines={disciplines} />
        </div>
      </section>
    </main>
  );
}
