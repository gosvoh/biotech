"use server";

import { dbAction } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { NewsTags } from "@/lib/db/client";

export async function addNewsTags(title: string) {
  return dbAction(
    prisma.newsTags.create({ data: { title } }),
    ["newsTags", "news"],
    true
  );
}

export async function updateNewsTags(newsTags: NewsTags) {
  return dbAction(
    prisma.newsTags.update({
      where: { id: newsTags.id },
      data: newsTags,
    }),
    ["newsTags", "news"],
    true
  );
}

export async function deleteNewsTags(id: string) {
  return dbAction(prisma.newsTags.delete({ where: { id } }), [
    "newsTags",
    "news",
  ]);
}
