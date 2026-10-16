import { prisma } from "@/prisma";
import { requireAdminPage } from "@/lib/utils.server";
import UsersClient from "./page.client";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { ADMIN_SECTIONS } from "@/lib/admin-access";
import type { AdminUserView } from "./types";

async function getUsers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("users");
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, accessStatus: true, createdAt: true,
      sectionPermissions: { select: { section: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return users.map((user): AdminUserView => ({
    id: user.id, email: user.email, name: user.name,
    role: user.role === "admin" ? "admin" : "user",
    accessStatus: user.accessStatus === "active" ? "active" : user.accessStatus === "blocked" ? "blocked" : "pending",
    sections: ADMIN_SECTIONS.filter(({ code }) => user.sectionPermissions.some(({ section }) => section === code)).map(({ code }) => code),
    createdAt: user.createdAt.toISOString(),
  }));
}

export default async function Users() {
  const access = await requireAdminPage();
  const users = await getUsers();

  return (
    <>
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <Suspense fallback={null}>
        <UsersClient users={users} userId={access.userId} />
      </Suspense>
    </>
  );
}
