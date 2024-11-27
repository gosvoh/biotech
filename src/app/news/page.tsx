import Breadcrumbs from "@/components/breadcrumbs";
import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import NewsClient from "./news.client";

const getNewsTags = cache(() => prisma.newsTags.findMany(), ["newsTags"], {
  revalidate: 60,
  tags: ["newsTags"],
});

export default async function News() {
  const newsTags = await getNewsTags();

  return (
    <main>
      <section className="space-y-6">
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Новости" }]}
        />
        <div className="wrapper">
          <h1>Новости</h1>
        </div>
      </section>

      <section>
        <div className="wrapper">
          <NewsClient newsTags={newsTags} />
        </div>
      </section>
    </main>
  );
}
