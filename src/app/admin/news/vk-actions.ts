"use server";
import { prisma } from "@/prisma";
import { actionResult, requireAdmin, revalidate } from "@/lib/utils.server";
import { disableVkSync, restoreVkPostExclusion } from "@/lib/vk-import/editor";
import { createNewsPhotoFiles } from "@/lib/vk-import/news-files";
import { getVkConfigStatus, readVkConfig } from "@/lib/vk-import/config";
import { createVkApi } from "@/lib/vk-import/client";
import { createVkImageStore } from "@/lib/vk-import/images";
import { syncVkNews } from "@/lib/vk-import/sync";

function editorOptions() { return { db: prisma, files: createNewsPhotoFiles(), invalidate: () => revalidate("news") }; }
async function checkPost(newsId: string, enableSync: boolean) {
  const state = await prisma.vkImportPost.findUnique({ where: { newsId }, select: { groupId: true, postId: true } });
  if (!state) throw new Error("Эта новость не связана с ВК");
  const config = getVkConfigStatus();
  if (!config.configured) throw new Error(config.error ?? "Настройте подключение к ВК");
  const result = await syncVkNews({ db: prisma, api: createVkApi(readVkConfig()), images: createVkImageStore(), removeOldImages: createNewsPhotoFiles().remove, invalidate: () => revalidate("news"), target: { ...state, enableSync } });
  if (!result.successful) throw new Error(result.error ?? "Не удалось проверить оригинал новости");
  return result;
}
export async function checkVkNewsPost(newsId: string) { return actionResult(async () => { await requireAdmin(); return checkPost(newsId, false); }); }
export async function enableVkNewsSync(newsId: string) { return actionResult(async () => { await requireAdmin(); return checkPost(newsId, true); }); }
export async function disableVkNewsSync(newsId: string) { return actionResult(async () => { await requireAdmin(); return disableVkSync(editorOptions(), newsId); }); }
export async function restoreVkNewsPost(groupId: string, postId: string) { return actionResult(async () => { await requireAdmin(); await restoreVkPostExclusion(editorOptions(), groupId, postId); }); }
