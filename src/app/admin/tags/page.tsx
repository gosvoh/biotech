import NewsTagsClient from "./page.client";
import { prisma } from "@/prisma";
import { requireAdminPage } from "@/lib/utils.server";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";

async function getNewsTags() {
  "use cache";
  cacheLife("minutes");
  cacheTag("newsTags");
  return prisma.newsTags.findMany();
}

export default async function NewsTags() {
  await requireAdminPage();
  const newsTags = await getNewsTags();

  return (
    <>
      <h1 className="text-2xl font-bold">Теги новостей</h1>
      <Suspense fallback={null}>
        <NewsTagsClient newsTags={newsTags} />
      </Suspense>
    </>
  );
}
