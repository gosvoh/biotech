import { prisma } from "@/prisma";
import { auth } from "@/auth";
import UsersClient from "./page.client";

export default async function Users() {
  const session = await auth();
  const users = await prisma.user.findMany();

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
