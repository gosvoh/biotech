"use server";

import { requireAdminSection } from "@/lib/admin-access.server";
import { prisma } from "@/prisma";
import { revalidate } from "@/lib/utils.server";
import type { ActionResult } from "@/lib/action-result";
import { getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus } from "@/lib/vk-import/config";
import { createVkAdminOptions } from "@/lib/vk-import/admin-options.server";
import { disableVkAutomation, enableVkAutomation, healVkRevalidation, VkAutomationError } from "@/lib/vk-import/automation";
import { getVkImportStatus } from "@/lib/vk-import/status.server";
import type { VkAutomationState } from "@/lib/vk-import/types";

export async function setVkNewsAutomation(enabled: boolean, expectedSource: string | null, expectedGroupId: string | null): Promise<ActionResult<VkAutomationState>> {
  try { await requireAdminSection("news"); }
  catch { return { ok: false, error: "Недостаточно прав для управления автоматическим импортом" }; }
  const config = getVkConfigStatus();
  if (typeof enabled !== "boolean" || typeof expectedSource !== "string" || !config.source || expectedSource.toLowerCase() !== config.source.toLowerCase()) return { ok: false, error: "Источник ВК изменился. Обновите страницу перед изменением расписания." };
  try {
    if (!enabled) {
      const status = await getVkImportStatus();
      if (!status.group || status.group.id !== expectedGroupId) return { ok: false, error: "Текущий источник ВК не найден. Обновите страницу." };
      const data = await disableVkAutomation(prisma, status.group.id);
      await healVkRevalidation(prisma, () => revalidate("news"));
      return { ok: true, data };
    }
    if (!config.configured) return { ok: false, error: config.error ?? "Настройте подключение к ВК" };
    return { ok: true, data: await enableVkAutomation({ ...createVkAdminOptions(), ...(expectedGroupId ? { currentGroupId: expectedGroupId } : {}) }) };
  } catch (error) { return { ok: false, error: error instanceof VkAutomationError ? error.message : getVkApiErrorMessage(error) }; }
}
