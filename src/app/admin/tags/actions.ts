"use server";

import { actionResult, dbAction, dbActionWithResult, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import { Prisma, type NewsTags } from "@/lib/db/client";
import { DUPLICATE_NEWS_TAG_ERROR, getNewsTagError, parseNewsTagTitle } from "@/lib/news-tags";

async function saveNewsTag(title: unknown, id?: string) {
  const parsed = parseNewsTagTitle(title);
  if (!parsed.ok) throw new Error(parsed.error);
  try {
    return await prisma.$transaction(async (tx) => {
      const tags = await tx.newsTags.findMany({ select: { id: true, title: true } });
      const error = getNewsTagError(parsed.title, tags, id);
      if (error) throw new Error(error);
      const data = { title: parsed.title, normalizedTitle: parsed.normalizedTitle };
      return id
        ? tx.newsTags.update({ where: { id }, data })
        : tx.newsTags.create({ data });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(DUPLICATE_NEWS_TAG_ERROR);
    }
    throw error;
  }
}

export async function addNewsTags(title: string) {
  return actionResult(async () => {
    await requireAdmin();
    return dbActionWithResult(saveNewsTag(title), ["newsTags", "news"]);
  });
}

export async function updateNewsTags(newsTags: Pick<NewsTags, "id" | "title">) {
  return actionResult(async () => {
    await requireAdmin();
    if (!newsTags || typeof newsTags.id !== "string" || !newsTags.id) throw new Error("Не указан тег");
    return dbActionWithResult(saveNewsTag(newsTags.title, newsTags.id), ["newsTags", "news"]);
  });
}

export async function deleteNewsTags(id: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.newsTags.delete({ where: { id } }), ["newsTags", "news"]);
  });
}
