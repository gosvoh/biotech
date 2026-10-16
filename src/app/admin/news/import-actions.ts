"use server";

import { requireAdminSection } from "@/lib/admin-access.server";

import { revalidate } from "@/lib/utils.server";
import type { ActionResult } from "@/lib/action-result";
import { getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus } from "@/lib/vk-import/config";
import { createVkAdminOptions } from "@/lib/vk-import/admin-options.server";
import { checkVkLatest } from "@/lib/vk-import/automation";
import { recheckVkTags, type VkTagRecheckResult } from "@/lib/vk-import/recheck";
import type { VkImportResult } from "@/lib/vk-import/types";

export async function checkVkNews(): Promise<ActionResult<VkImportResult>> {
  try { await requireAdminSection("news"); }
  catch { return { ok: false, error: "Недостаточно прав для импорта новостей" }; }
  const status = getVkConfigStatus();
  if (!status.configured) return { ok: false, error: status.error ?? "Настройте подключение к ВК на сервере" };
  try {
    const result = await checkVkLatest({
      ...createVkAdminOptions(),
      isCurrentSource: () => getVkConfigStatus().source === status.source,
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getVkApiErrorMessage(error) };
  }
}

export async function recheckVkNewsTags(): Promise<ActionResult<VkTagRecheckResult>> {
  try { await requireAdminSection("news"); }
  catch { return { ok: false, error: "Недостаточно прав для пересмотра тегов" }; }
  const status = getVkConfigStatus();
  if (!status.configured) return { ok: false, error: status.error ?? "Настройте подключение к ВК" };
  try {
    return { ok: true, data: await recheckVkTags({ ...createVkAdminOptions(), invalidate: () => revalidate(["newsTags", "news"]) }) };
  } catch (error) { return { ok: false, error: getVkApiErrorMessage(error) }; }
}
