import VkExclusions from "./vk-exclusions";
import { getExcludedVkPosts } from "@/lib/vk-import/news-state.server";
import VkImportPanel from "./import-panel";
import { getVkImportStatus } from "@/lib/vk-import/status.server";
import { newsOrderBy, newsImagesOrderBy } from "@/lib/news-order";
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
      orderBy: newsOrderBy,
    select: {
      id: true,
      date: true,
      hidden: true,
      links: true,
      tags: true,
      title: true,
      vkImport: {select:{groupId:true,postId:true,syncEnabled:true,manualHidden:true,autoHiddenReason:true}},
      images: { select: { id: true }, orderBy: newsImagesOrderBy },
    },
  });
}

export default async function News() {
  await requireAdminPage();
  const [news, importStatus, exclusions] = await Promise.all([getNews(), getVkImportStatus(), getExcludedVkPosts()]);

  return (
    <>
      <h1 className="text-2xl font-bold">Новости</h1>
      <Suspense fallback={null}>
        <VkImportPanel initialStatus={importStatus} />
        <VkExclusions posts={exclusions} />
        <NewsClient news={news} />
      </Suspense>
    </>
  );
}
