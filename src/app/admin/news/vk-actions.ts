"use server";

import { requireAdminSection } from "@/lib/admin-access.server";
import { prisma } from "@/prisma";
import { actionResult } from "@/lib/utils.server";
import { disableVkSync, restoreVkPostExclusion } from "@/lib/vk-import/editor";
import { getVkConfigStatus } from "@/lib/vk-import/config";
import { createNewsAdminOptions, createVkAdminOptions } from "@/lib/vk-import/admin-options.server";
import { syncVkNews } from "@/lib/vk-import/sync";

async function checkPost(newsId: string, enableSync: boolean) {
  const state = await prisma.vkImportPost.findUnique({ where: { newsId }, select: { groupId: true, postId: true } });
  if (!state) throw new Error("Эта новость не связана с ВК");
  const config = getVkConfigStatus();
  if (!config.configured) throw new Error(config.error ?? "Настройте подключение к ВК");
  const result = await syncVkNews({ ...createVkAdminOptions(), target: { ...state, enableSync } });
  if (!result.successful) throw new Error(result.error ?? "Не удалось проверить оригинал новости");
  return result;
}
export async function checkVkNewsPost(newsId: string) { return actionResult(async () => { await requireAdminSection("news"); return checkPost(newsId, false); }); }
export async function enableVkNewsSync(newsId: string) { return actionResult(async () => { await requireAdminSection("news"); return checkPost(newsId, true); }); }
export async function disableVkNewsSync(newsId: string) { return actionResult(async () => { await requireAdminSection("news"); return disableVkSync(createNewsAdminOptions(), newsId); }); }
export async function restoreVkNewsPost(groupId: string, postId: string) { return actionResult(async () => { await requireAdminSection("news"); await restoreVkPostExclusion(createNewsAdminOptions(), groupId, postId); }); }
