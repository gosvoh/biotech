import NewsClient from "./page.client";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";

async function getNews(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.news.findFirst({
    where: { id },
    include: { tags: true, images: true },
  });
}

async function getNewsTags() {
  "use cache";
  cacheLife("minutes");
  cacheTag("newsTags");
  return prisma.newsTags.findMany();
}

export default async function News({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  const tags = await getNewsTags();

  if (id === "new") return <NewsClient tags={tags} />;

  const news = await getNews(id);

  if (!news) notFound();

  return <NewsClient news={news} tags={tags} />;
}
