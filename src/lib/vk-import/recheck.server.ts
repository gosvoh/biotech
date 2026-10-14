import { prisma } from "@/prisma";
import { revalidate } from "@/lib/utils.server";
import { createVkApi, getVkApiErrorMessage } from "./client";
import { getVkConfigStatus, readVkConfig } from "./config";
import { createVkImageStore } from "./images";
import { getVkTagRecheckStatus, recheckVkTags } from "./recheck";

/** The durable catalogue signal survives all best-effort network failures. */
export async function drainVkTagRecheck() {
  try {
    const queued = await getVkTagRecheckStatus(prisma);
    if (!queued.pending) return;
    const status = getVkConfigStatus();
    if (!status.configured) {
      await prisma.vkImportTagCatalog.updateMany({
        where: { id: 1, revision: queued.revision },
        data: { lastAttemptAt: new Date(), lastError: status.error },
      });
      return;
    }
    await recheckVkTags({
      db: prisma, api: createVkApi(readVkConfig()), images: createVkImageStore(), invalidate: () => revalidate(["newsTags", "news"]),
    });
  } catch (error) {
    // Never report a successfully saved tag as failed: that invites a duplicate create.
    try {
      await prisma.vkImportTagCatalog.updateMany({ where: { id: 1 }, data: { lastError: getVkApiErrorMessage(error) } });
    } catch { /* The generation was already saved with the catalogue transaction. */ }
  }
}
