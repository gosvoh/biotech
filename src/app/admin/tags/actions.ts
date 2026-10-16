"use server";

import { requireAdminSection } from "@/lib/admin-access.server";

import { actionResult, dbAction, revalidate } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import { markVkTagCatalogChanged } from "@/lib/vk-import/recheck";
import { drainVkTagRecheck } from "@/lib/vk-import/recheck.server";
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
      const tag = id
        ? await tx.newsTags.update({ where: { id }, data })
        : await tx.newsTags.create({ data });
      const changed = !id || tags.find((existing) => existing.id === id)?.title !== parsed.title;
      if (changed) await markVkTagCatalogChanged(tx);
      return { tag, changed };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(DUPLICATE_NEWS_TAG_ERROR);
    }
    throw error;
  }
}

async function saveAndRecheckNewsTag(title: unknown, id?: string) {
  const saved = await saveNewsTag(title, id);
  if (saved.changed) await drainVkTagRecheck();
  // The tag and its durable queue are committed; cache/network failure must not invite duplicate creation.
  try { revalidate(["newsTags", "news"]); } catch { /* A later successful check refreshes news. */ }
  return saved.tag;
}

export async function addNewsTags(title: string) {
  return actionResult(async () => {
    await requireAdminSection("news");
    return saveAndRecheckNewsTag(title);
  });
}

export async function updateNewsTags(newsTags: Pick<NewsTags, "id" | "title">) {
  return actionResult(async () => {
    await requireAdminSection("news");
    if (!newsTags || typeof newsTags.id !== "string" || !newsTags.id) throw new Error("Не указан тег");
    return saveAndRecheckNewsTag(newsTags.title, newsTags.id);
  });
}

export async function deleteNewsTags(id: string) {
  return actionResult(async () => {
    await requireAdminSection("news");
    await dbAction(prisma.newsTags.delete({ where: { id } }), ["newsTags", "news"]);
  });
}
