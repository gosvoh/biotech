"use server";

import { dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";

export async function changeRole(userId: string, role: string) {
  await requireAdmin();
  return dbAction(
    prisma.user.update({ where: { id: userId }, data: { role } }),
    "users"
  );
}

export async function deleteUser(userId: string) {
  await requireAdmin();
  return dbAction(prisma.user.delete({ where: { id: userId } }), "users");
}
