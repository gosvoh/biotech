import { prisma } from "@/prisma";
import { getVkImportStatus } from "./status.server";
import { getVkAutomationState } from "./automation";
import type { VkAutomationState } from "./types";

/** The configured source alone supplies the toggle; a previous group cannot lend its enabled state. */
export async function getVkAutomationPanelState(): Promise<VkAutomationState> {
  try { return await getVkAutomationState(prisma, (await getVkImportStatus()).group?.id ?? null); }
  catch { return { groupId: null, enabled: false, initialHistoryId: null, initialState: null, lastNewAt: null, lastSyncAt: null, nextNewAt: null, nextSyncAt: null, lastWorkerAt: null, error: "Не удалось прочитать расписание. Проверьте миграции и обновите страницу.", running: false, queued: false }; }
}
