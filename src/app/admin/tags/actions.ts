"use server";

import {
  actionResult,
  dbAction,
  dbActionWithResult,
  requireAdmin,
} from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { NewsTags } from "@/lib/db/client";

export async function addNewsTags(title: string) {
  return actionResult(async () => {
    await requireAdmin();
    return dbActionWithResult(prisma.newsTags.create({ data: { title } }), [
      "newsTags",
      "news",
    ]);
  });
}

export async function updateNewsTags(newsTags: NewsTags) {
  return actionResult(async () => {
    await requireAdmin();
    return dbActionWithResult(
      prisma.newsTags.update({
        where: { id: newsTags.id },
        data: newsTags,
      }),
      ["newsTags", "news"]
    );
  });
}

export async function deleteNewsTags(id: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.newsTags.delete({ where: { id } }), [
      "newsTags",
      "news",
    ]);
  });
}
