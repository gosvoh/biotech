import { getVkAutomationPanelState } from "@/lib/vk-import/automation-state.server";
import VkHistoryPanel from "./history-panel";
import { getVkHistoryPanelState, getVkTagRecheckPanelState } from "@/lib/vk-import/history-state.server";
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
  const [news, importStatus, exclusions, history, automation] = await Promise.all([getNews(), getVkImportStatus(), getExcludedVkPosts(), getVkHistoryPanelState(), getVkAutomationPanelState()]);
  const tagStatus = await getVkTagRecheckPanelState(importStatus.group?.id);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <>
      <h1 className="text-2xl font-bold">Новости</h1>
      <Suspense fallback={null}>
        <VkImportPanel initialStatus={importStatus} initialTagStatus={tagStatus} initialAutomation={automation} />
        <VkHistoryPanel configured={importStatus.configured} initialJobs={history.jobs} today={today} loadError={history.error} />
        <VkExclusions posts={exclusions} />
        <NewsClient news={news} />
      </Suspense>
    </>
  );
}
