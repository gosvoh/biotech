import { prisma } from "@/prisma";
import { auth } from "@/auth";
import UsersClient from "./page.client";
import { unstable_cache as cache } from "next/cache";

const getUsers = cache(() => prisma.user.findMany(), ["users"], {
  revalidate: 60,
  tags: ["users"],
});

export default async function Users() {
  const session = await auth();
  const users = await getUsers();

  return (
    <main>
      <section>
        <div className="wrapper">
          <UsersClient users={users} userId={session?.user.id} />
        </div>
      </section>
    </main>
  );
}
