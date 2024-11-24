"use server";

import { prisma } from "@/prisma";
import type { News } from "@/lib/db/client";
import { dbAction } from "@/lib/utils";
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
  const image = formData.get("image") as File;

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
      await sharp(await image.arrayBuffer()).toFile(
        `./uploads/news/${newNews.id}.webp`
      );
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
  const image = formData.get("image") as File;

  if (!news.id || !news.title || !news.text || !news.date || !tags.length) {
    return Promise.reject("Please fill out the required fields.");
  }

  return dbAction(
    prisma.$transaction(async (prisma) => {
      const n = await prisma.news.update({
        where: { id: news.id },
        data: {
          ...news,
          tags: { set: tags.map((id) => ({ id })) },
        },
      });
      if (image) {
        await fs.mkdir("uploads/news", { recursive: true });
        await sharp(await image.arrayBuffer()).toFile(
          `./uploads/news/${news.id}.webp`
        );
      }
      return n;
    }),
    "news",
    true
  );
}
