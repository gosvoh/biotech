"use server";

import { prisma } from "@/prisma";

export async function changeRole(userId: string, role: string) {
  return prisma.user
    .update({
      where: { id: userId },
      data: { role },
    })
    .then(() => true);
}

export async function deleteUser(userId: string) {
  return prisma.user.delete({ where: { id: userId } }).then(() => true);
}
