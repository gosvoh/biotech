import { prisma } from "@/prisma";
import { auth } from "@/auth";
import UsersClient from "./page.client";
import { cacheLife, cacheTag } from "next/cache";

async function getUsers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("users");
  return prisma.user.findMany();
}

export default async function Users() {
  const session = await auth();
  const users = await getUsers();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <UsersClient users={users} userId={session?.user.id} />
        </div>
      </section>
    </main>
  );
}
