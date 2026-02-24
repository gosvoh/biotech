import Breadcrumbs from "@/components/breadcrumbs";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import NewsClient from "./news.client";
import { Suspense } from "react";
import type { Metadata } from "next";
import { generateMeta } from "@/lib/meta";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Новости",
  "Новости факультета биотехнологий университета ИТМО",
  "/news",
);

async function getNewsTags() {
  "use cache";
  cacheLife("minutes");
  cacheTag("newsTags");
  return prisma.newsTags.findMany();
}

export default async function News() {
  const newsTags = await getNewsTags();

  return (
    <main>
      <section>
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Новости" }]}
        />
        <div className="wrapper">
          <h1>Новости</h1>
        </div>
      </section>

      <section>
        <div className="wrapper">
          <Suspense>
            <NewsClient newsTags={newsTags} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
