import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import NewsClient from "./page.client";
import { connection } from "next/server";

async function getNews() {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.news.findMany({
    select: {
      id: true,
      date: true,
      hidden: true,
      links: true,
      tags: true,
      title: true,
      images: { select: { id: true } },
    },
  });
}

export default async function News() {
  await connection();
  const news = await getNews();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Новости</h1>
          <NewsClient news={news} />
        </div>
      </section>
    </main>
  );
}
