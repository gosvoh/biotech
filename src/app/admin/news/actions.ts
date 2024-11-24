"use server";

import { dbAction } from "@/lib/utils";
import { prisma } from "@/prisma";
import fs from "fs/promises";

export async function deleteNews(id: string) {
  return dbAction(
    prisma.$transaction(async (prisma) => {
      await prisma.news.delete({ where: { id } });
      await fs.unlink(`./uploads/news/${id}.webp`);
    }),
    "news"
  );
}

export async function changeVisibility(id: string, hidden: boolean) {
  return dbAction(
    prisma.news.update({
      where: { id },
      data: { hidden },
    }),
    "news"
  );
}

export async function duplicateNews(id: string) {
  return dbAction(
    prisma.$transaction(async (prisma) => {
      const news = await prisma.news.findUnique({
        where: { id },
        include: { tags: true },
      });
      if (!news) {
        throw new Error("News not found");
      }

      const tags = news.tags;

      const newsToCreate: Optional<typeof news, "id" | "tags"> = { ...news };
      delete newsToCreate.id;
      delete newsToCreate.tags;
      newsToCreate.hidden = true;

      const newNews = await prisma.news.create({
        data: {
          ...newsToCreate,
          tags: { connect: tags.map((t) => ({ id: t.id })) },
        },
      });
      await fs.copyFile(
        `./uploads/news/${news.id}.webp`,
        `./uploads/news/${newNews.id}.webp`
      );
    }),
    "news"
  );
}
