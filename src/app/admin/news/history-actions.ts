"use server";

import { requireAdminSection } from "@/lib/admin-access.server";
import { prisma } from "@/prisma";
import { listVkHistoryDetails } from "@/lib/vk-import/history-details";


import type { ActionResult } from "@/lib/action-result";
import { getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus } from "@/lib/vk-import/config";
import { createVkAdminOptions } from "@/lib/vk-import/admin-options.server";
import { queueVkHistory, runVkHistoryBatch, VkHistoryError } from "@/lib/vk-import/history";
import type { VkHistoryDetailsPage, VkHistoryState } from "@/lib/vk-import/types";

async function historyAction(operation: (options: Parameters<typeof queueVkHistory>[0]) => Promise<VkHistoryState>): Promise<ActionResult<VkHistoryState>> {
  try { await requireAdminSection("news"); }
  catch { return { ok: false, error: "Недостаточно прав для импорта истории" }; }
  const config = getVkConfigStatus();
  if (!config.configured) return { ok: false, error: config.error ?? "Настройте подключение к ВК" };
  try {
    const data = await operation(createVkAdminOptions());
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
export async function getVkNewsHistoryDetails(input: unknown): Promise<ActionResult<VkHistoryDetailsPage>> {
  try { await requireAdminSection("news"); }
  catch { return { ok: false, error: "Недостаточно прав для просмотра истории" }; }
  try { return { ok: true, data: await listVkHistoryDetails(prisma, input) }; }
  catch (error) { return { ok: false, error: error instanceof VkHistoryError ? error.message : "Не удалось загрузить подробности истории. Повторите запрос." }; }
}
