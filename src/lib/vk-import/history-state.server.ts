import { prisma } from "@/prisma";
import { getVkImportStatus } from "./status.server";
import { getVkTagRecheckStatus, type VkTagRecheckStatus } from "./recheck";
import { listVkHistory } from "./history";
import type { VkHistoryState } from "./types";

/** Reads saved progress for the current configured source without requesting VK. */
export async function getVkHistoryPanelState(): Promise<{ jobs: VkHistoryState[]; error: string | null }> {
  try {
    const status = await getVkImportStatus();
    if (!status.group) return { jobs: [], error: status.error };
    return { jobs: await listVkHistory(prisma, status.group.id), error: null };
  } catch { return { jobs: [], error: "Не удалось прочитать прогресс истории. Проверьте миграции и повторите попытку." }; }
}

export async function getVkTagRecheckPanelState(groupId?: string): Promise<VkTagRecheckStatus | null> {
  try { return await getVkTagRecheckStatus(prisma, groupId); }
  catch { return null; }
}
