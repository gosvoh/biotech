import { prisma } from "@/prisma";
import { requireAdminPage } from "@/lib/utils.server";
import UsersClient from "./page.client";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";

async function getUsers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("users");
  return prisma.user.findMany();
}

export default async function Users() {
  const session = await requireAdminPage();
  const users = await getUsers();

  return (
    <>
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <Suspense fallback={null}>
        <UsersClient users={users} userId={session?.user.id} />
      </Suspense>
    </>
  );
}
