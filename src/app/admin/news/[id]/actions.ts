"use server";

import { prisma } from "@/prisma";
import {
  actionResult,
  dbActionWithResult,
  requireAdmin,
} from "@/lib/utils.server";
import fs from "fs/promises";
import { z } from "zod";

const newsSchema = z.object({
  title: z.string().trim().min(1, "Please fill out the required fields."),
  text: z.string().trim().min(1, "Please fill out the required fields."),
  date: z.string().trim().min(1, "Please fill out the required fields."),
  links: z.string().default(""),
  hidden: z.boolean(),
  tags: z
    .array(z.string().min(1))
    .min(1, "Please fill out the required fields."),
});

function parseNewsForm(formData: FormData) {
  const tagsStr = (formData.get("tags") as string | null) ?? "";
  return newsSchema.safeParse({
    title: formData.get("title"),
    text: formData.get("text"),
    date: formData.get("date"),
    links: formData.get("links") ?? "",
    hidden: formData.get("hidden") === "true",
    tags: tagsStr ? tagsStr.split(",") : [],
  });
}

export async function addNews(formData: FormData) {
  return actionResult(async () => {
    await requireAdmin();

    const parsed = parseNewsForm(formData);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { tags, ...news } = parsed.data;
    const images = formData
      .getAll("images")
      .filter((x): x is File => x instanceof File);

    return dbActionWithResult(
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
          // Bun.Image (no native libvips, survives the standalone build) takes
          // the first frame; animated GIF/WebP uploads are flattened to a
          // static webp, matching how updateNews already handles them.
          await new Bun.Image(await image.arrayBuffer())
            .webp()
            .write(`./uploads/news/${n.id}.webp`);
        }
        return newNews;
      }),
      "news"
    );
  });
}

export async function updateNews(formData: FormData) {
  return actionResult(async () => {
    await requireAdmin();

    const id = formData.get("id");
    if (typeof id !== "string" || !id) {
      throw new Error("Please fill out the required fields.");
    }
    const parsed = parseNewsForm(formData);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { tags, ...news } = parsed.data;
    const images = formData.getAll("images") as (File | string)[];

    return dbActionWithResult(
      prisma.$transaction(async (prisma) => {
        const newNews = await prisma.news.update({
          where: { id },
          data: {
            ...news,
            tags: { set: tags.map((id) => ({ id })) },
          },
          include: {
            images: {
              where: {
                NOT: {
                  id: { in: images.filter((x) => typeof x === "string") },
                },
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
              data: { newsId: id },
            });
            await new Bun.Image(await image.arrayBuffer())
              .webp()
              .write(`./uploads/news/${n.id}.webp`);
          }
        }
        return newNews;
      }),
      "news"
    );
  });
}
