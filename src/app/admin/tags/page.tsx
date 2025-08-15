import NewsTagsClient from "./page.client";
import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";

const getNewsTags = cache(() => prisma.newsTags.findMany(), ["newsTags"], {
  revalidate: 60,
  tags: ["newsTags"],
});

export default async function NewsTags() {
  const newsTags = await getNewsTags();

  return (
    <main>
      <section>
        <div className="wrapper">
          <h1 className="text-2xl font-bold">Теги новостей</h1>
          <NewsTagsClient newsTags={newsTags} />
        </div>
      </section>
    </main>
  );
}
