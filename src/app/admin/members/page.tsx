import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import MembersClient from "./page.client";

const getMembers = cache(() => prisma.member.findMany(), ["members"], {
  revalidate: 60,
  tags: ["members"],
});
const getDepartments = cache(
  () => prisma.department.findMany(),
  ["departments"],
  {
    revalidate: 60,
    tags: ["departments"],
  }
);

export default async function Members() {
  const members = await getMembers();
  const departments = await getDepartments();

  return (
    <main>
      <section>
        <div className="wrapper">
          <MembersClient members={members} departments={departments} />
        </div>
      </section>
    </main>
  );
}
