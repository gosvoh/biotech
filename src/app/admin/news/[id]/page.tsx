import { requireAdminSectionPage } from "@/lib/admin-access.server";
import { createHash } from "node:crypto";
import { getVkNewsState } from "@/lib/vk-import/news-state.server";
import { getVkImportStatus } from "@/lib/vk-import/status.server";
import { newsImagesOrderBy } from "@/lib/news-order";
import NewsClient from "./page.client";
import { prisma } from "@/prisma";

import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

async function getNews(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.news.findFirst({
    where: { id },
    include: { tags: true, images: { orderBy: newsImagesOrderBy } },
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
  await requireAdminSectionPage("news");
  const id = (await params).id;
  const tags = await getNewsTags();

  if (id === "new")
    return (
      <Suspense fallback={null}>
        <NewsClient tags={tags} />
      </Suspense>
    );

  const [news, vkState, importStatus] = await Promise.all([getNews(id), getVkNewsState(id), getVkImportStatus()]);

  if (!news) notFound();
  const editorKey = createHash("sha256").update(JSON.stringify([news.title,news.text,news.date,news.links,news.tags.map(tag=>tag.id).sort(),news.images.map(image=>image.id)])).digest("hex");

  return (
    <Suspense fallback={null}>
      <NewsClient key={editorKey} news={news} tags={tags} vkState={vkState} canCheck={importStatus.configured && importStatus.group?.id === vkState?.groupId} />
    </Suspense>
  );
}
