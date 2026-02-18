import NewsTagsClient from "./page.client";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

async function getNewsTags() {
  "use cache";
  cacheLife("minutes");
  cacheTag("newsTags");
  return prisma.newsTags.findMany();
}

export default async function NewsTags() {
  await connection();
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
