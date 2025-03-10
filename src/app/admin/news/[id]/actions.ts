"use server";

import { prisma } from "@/prisma";
import type { News } from "@/lib/db/client";
import { dbAction } from "@/lib/utils.server";
import sharp from "sharp";
import fs from "fs/promises";

export async function addNews(formData: FormData) {
  const news: Omit<News, "id"> = {
    title: formData.get("title") as string,
    text: formData.get("text") as string,
    date: formData.get("date") as string,
    hidden: formData.get("hidden") === "true",
    links: formData.get("links") as string,
  };
  const tagsStr = formData.get("tags") as string;
  const tags = tagsStr ? tagsStr.split(",") : [];
  const images = formData.getAll("images") as File[];

  console.log(images);

  if (!news.title || !news.text || !news.date || !tags.length) {
    return Promise.reject("Please fill out the required fields.");
  }

  return dbAction(
    prisma.$transaction(async (prisma) => {
      const newNews = await prisma.news.create({
        data: {
          ...news,
          tags: { connect: tags.map((id) => ({ id })) },
        },
      });
      await fs.mkdir("uploads/news", { recursive: true });
      for (const image of images) {
        const n = await prisma.newsImages.create({
          data: { newsId: newNews.id },
        });
        console.log(image, n);
        await sharp(await image.arrayBuffer(), { animated: true }).toFile(
          `./uploads/news/${n.id}.webp`
        );
      }
      return newNews;
    }),
    "news",
    true
  );
}

export async function updateNews(formData: FormData) {
  const news: News = {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    text: formData.get("text") as string,
    date: formData.get("date") as string,
    hidden: formData.get("hidden") === "true",
    links: formData.get("links") as string,
  };
  const tagsStr = formData.get("tags") as string;
  const tags = tagsStr ? tagsStr.split(",") : [];
  const images = formData.getAll("images") as (File | string)[];

  if (!news.id || !news.title || !news.text || !news.date || !tags.length) {
    return Promise.reject("Please fill out the required fields.");
  }

  return dbAction(
    prisma.$transaction(async (prisma) => {
      const newNews = await prisma.news.update({
        where: { id: news.id },
        data: {
          ...news,
          tags: { set: tags.map((id) => ({ id })) },
        },
        include: {
          images: {
            where: {
              NOT: { id: { in: images.filter((x) => typeof x === "string") } },
            },
          },
        },
      });

      await prisma.newsImages.deleteMany({
        where: { id: { in: newNews.images.map((x) => x.id) } },
      });

      if (newNews.images.length) {
        await Promise.all(
          newNews.images.map(({ id }) =>
            fs.unlink(`./uploads/news/${id}.webp`).catch(() => {})
          )
        );
      }

      if (images.length) {
        await fs.mkdir("uploads/news", { recursive: true });
        for (const image of images) {
          if (typeof image === "string") continue;
          const n = await prisma.newsImages.create({
            data: { newsId: news.id },
          });
          await sharp(await image.arrayBuffer()).toFile(
            `./uploads/news/${n.id}.webp`
          );
        }
      }
      return newNews;
    }),
    "news",
    true
  );
}
