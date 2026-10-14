"use server";

import { prisma } from "@/prisma";
import { requireAdmin, revalidate } from "@/lib/utils.server";
import type { ActionResult } from "@/lib/action-result";
import { createVkApi, getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus, readVkConfig } from "@/lib/vk-import/config";
import { createVkImageStore } from "@/lib/vk-import/images";
import { createNewsPhotoFiles } from "@/lib/vk-import/news-files";
import { queueVkHistory, runVkHistoryBatch, VkHistoryError } from "@/lib/vk-import/history";
import type { VkHistoryState } from "@/lib/vk-import/types";

async function historyAction(operation: (options: Parameters<typeof queueVkHistory>[0]) => Promise<VkHistoryState>): Promise<ActionResult<VkHistoryState>> {
  try { await requireAdmin(); }
  catch { return { ok: false, error: "Недостаточно прав для импорта истории" }; }
  const config = getVkConfigStatus();
  if (!config.configured) return { ok: false, error: config.error ?? "Настройте подключение к ВК" };
  try {
    const data = await operation({ db: prisma, api: createVkApi(readVkConfig()), images: createVkImageStore(), removeOldImages: createNewsPhotoFiles().remove, invalidate: () => revalidate("news") });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof VkHistoryError ? error.message : getVkApiErrorMessage(error) };
  }
}

export async function queueVkNewsHistory(from: string, to: string) {
  return historyAction((options) => queueVkHistory(options, { from, to }));
}
export async function continueVkNewsHistory(id: string) {
  return historyAction((options) => runVkHistoryBatch(options, id));
}
