import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import NewsClient from "./page.client";

const getNews = cache(
  () =>
    prisma.news.findMany({
      select: {
        id: true,
        date: true,
        hidden: true,
        links: true,
        tags: true,
        title: true,
      },
    }),
  ["news"],
  {
    revalidate: 60,
    tags: ["news"],
  }
);

export default async function News() {
  const news = await getNews();

  return (
    <main>
      <section>
        <div className="wrapper">
          <NewsClient news={news} />
        </div>
      </section>
    </main>
  );
}
