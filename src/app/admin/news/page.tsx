import { prisma } from "@/prisma";
import { requireAdminPage } from "@/lib/utils.server";
import { cacheLife, cacheTag } from "next/cache";
import NewsClient from "./page.client";
import { Suspense } from "react";

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
  await requireAdminPage();
  const news = await getNews();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Новости</h1>
          <Suspense fallback={null}>
            <NewsClient news={news} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
