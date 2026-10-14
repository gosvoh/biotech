import { prisma } from "@/prisma";
import { getVkConfigStatus } from "./config";
import type { VkImportResult, VkImportStatus } from "./types";

/** No credentials or network requests cross this administrative read boundary. */
export async function getVkImportStatus(): Promise<VkImportStatus> {
  const config = getVkConfigStatus();
  const status: VkImportStatus = { ...config, group: null, lastAttemptAt: null, lastSuccessAt: null, lastResult: null };
  if (!config.configured || !config.source) return status;
  try {
    const source = config.source.toLowerCase();
    const numeric = /^-?\d+$/.test(source) ? String(Math.abs(Number(source))) : null;
    const sources = await prisma.vkImportSource.findMany();
    const stored = sources.find((item) => numeric ? item.groupId === numeric : item.screenName.toLowerCase() === source);
    if (!stored) return status;
    return {
      ...status,
      group: { id: stored.groupId, name: stored.name, screenName: stored.screenName },
      lastAttemptAt: stored.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: stored.lastSuccessAt?.toISOString() ?? null,
      lastResult: stored.lastResult as unknown as VkImportResult | null,
      error: stored.lastError,
    };
  } catch {
    return { ...status, error: "Не удалось прочитать состояние импорта. Проверьте миграции базы и повторите попытку." };
  }
}
