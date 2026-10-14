"use server";

import { prisma } from "@/prisma";
import { revalidate, requireAdmin } from "@/lib/utils.server";
import type { ActionResult } from "@/lib/action-result";
import { createVkApi, getVkApiErrorMessage } from "@/lib/vk-import/client";
import { getVkConfigStatus, readVkConfig } from "@/lib/vk-import/config";
import { createVkImageStore } from "@/lib/vk-import/images";
import { importVkNews } from "@/lib/vk-import/importer";
import type { VkImportResult } from "@/lib/vk-import/types";

export async function checkVkNews(): Promise<ActionResult<VkImportResult>> {
  try { await requireAdmin(); }
  catch { return { ok: false, error: "Недостаточно прав для импорта новостей" }; }
  const status = getVkConfigStatus();
  if (!status.configured) return { ok: false, error: status.error ?? "Настройте подключение к ВК на сервере" };
  try {
    const result = await importVkNews({
      db: prisma, api: createVkApi(readVkConfig()), images: createVkImageStore(),
      invalidate: () => revalidate("news"),
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getVkApiErrorMessage(error) };
  }
}
