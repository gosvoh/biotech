import { prisma } from "@/prisma";
import { getVkConfigStatus } from "./config";
import type { VkImportResult, VkImportStatus, VkSyncResult } from "./types";

/** No credentials or network requests cross this administrative read boundary. */
export async function getVkImportStatus(): Promise<VkImportStatus> {
  const config = getVkConfigStatus();
  const status: VkImportStatus = { ...config, group: null, lastAttemptAt: null, lastSuccessAt: null, lastResult: null };
  if (!config.source) return status;
  try {
    const source = config.source.toLowerCase();
    const numeric = /^-?\d+$/.test(source) ? String(Math.abs(Number(source))) : null;
    const sources = await prisma.vkImportSource.findMany();
    const stored = sources.find((item) => numeric ? item.groupId === numeric : item.screenName.toLowerCase() === source);
    if (!stored) return status;
    const imported = stored.lastResult as unknown as VkImportResult | null;
    const synced = stored.lastSyncResult as unknown as VkSyncResult | null;
    const combined = imported && synced ? {...imported,sync:synced,successful:imported.successful && synced.successful,error:imported.error ?? synced.error} : imported;
    return {
      ...status,
      group: { id: stored.groupId, name: stored.name, screenName: stored.screenName },
      lastAttemptAt: stored.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: stored.lastSuccessAt?.toISOString() ?? null,
      lastResult: combined,
      lastSyncAt: stored.lastSyncAt?.toISOString() ?? null,
      lastSyncResult: stored.lastSyncResult as unknown as VkSyncResult | null,
      error: config.error ?? stored.lastError ?? stored.lastSyncError,
    };
  } catch {
    return { ...status, error: "Не удалось прочитать состояние импорта. Проверьте миграции базы и повторите попытку." };
  }
}
