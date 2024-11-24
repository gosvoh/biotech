import NewsClient from "./page.client";
import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import { notFound } from "next/navigation";

const getNews = cache(
  (id: string) =>
    prisma.news.findFirst({ where: { id }, include: { tags: true } }),
  ["news"],
  {
    revalidate: 60,
    tags: ["news"],
  }
);
const getNewsTags = cache(() => prisma.newsTags.findMany(), ["newsTags"], {
  revalidate: 60,
  tags: ["newsTags"],
});

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
