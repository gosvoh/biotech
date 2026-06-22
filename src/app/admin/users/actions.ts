"use server";

import { actionResult, dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import { z } from "zod";

const roleSchema = z.enum(["admin", "user"]);

export async function changeRole(userId: string, role: string) {
  return actionResult(async () => {
    await requireAdmin();
    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) throw new Error("Invalid role.");
    await dbAction(
      prisma.user.update({ where: { id: userId }, data: { role: parsed.data } }),
      "users"
    );
  });
}

export async function deleteUser(userId: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.user.delete({ where: { id: userId } }), "users");
  });
}
