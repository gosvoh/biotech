"use server";

import { prisma } from "@/prisma";
import { revalidate, requireAdmin } from "@/lib/utils.server";
import type { ActionResult } from "@/lib/action-result";
import { createVkApi, getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus, readVkConfig } from "@/lib/vk-import/config";
import { createVkImageStore } from "@/lib/vk-import/images";
import { importVkNews } from "@/lib/vk-import/importer";
import { syncVkNews } from "@/lib/vk-import/sync";
import { createNewsPhotoFiles } from "@/lib/vk-import/news-files";
import { recheckVkTags, type VkTagRecheckResult } from "@/lib/vk-import/recheck";
import type { VkImportResult } from "@/lib/vk-import/types";

export async function checkVkNews(): Promise<ActionResult<VkImportResult>> {
  try { await requireAdmin(); }
  catch { return { ok: false, error: "Недостаточно прав для импорта новостей" }; }
  const status = getVkConfigStatus();
  if (!status.configured) return { ok: false, error: status.error ?? "Настройте подключение к ВК на сервере" };
  try {
    const api = createVkApi(readVkConfig());
    const result = await importVkNews({
      db: prisma, api, images: createVkImageStore(),
      invalidate: () => revalidate("news"),
    });
    // A failed new post must not block checking already published news.
    result.sync = await syncVkNews({db:prisma,api:{...api,getGroup:async()=>result.group},images:createVkImageStore(),removeOldImages:createNewsPhotoFiles().remove,invalidate:()=>revalidate("news")});
    result.successful = result.successful && result.sync.successful;
    result.error ??= result.sync.error;
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getVkApiErrorMessage(error) };
  }
}

export async function recheckVkNewsTags(): Promise<ActionResult<VkTagRecheckResult>> {
  try { await requireAdmin(); }
  catch { return { ok: false, error: "Недостаточно прав для пересмотра тегов" }; }
  const status = getVkConfigStatus();
  if (!status.configured) return { ok: false, error: status.error ?? "Настройте подключение к ВК" };
  try {
    return { ok: true, data: await recheckVkTags({ db: prisma, api: createVkApi(readVkConfig()), images: createVkImageStore(), invalidate: () => revalidate(["newsTags", "news"]) }) };
  } catch (error) { return { ok: false, error: getVkApiErrorMessage(error) }; }
}
