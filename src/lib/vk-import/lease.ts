import type { Prisma, PrismaClient } from "@/lib/db/client";
export const VK_LEASE_MS = 5 * 60 * 1000;
export class LostVkLease extends Error {
}
export interface VkAutomationGuard {
  revision?: number;
  signal?: AbortSignal;
  isCurrentSource?: () => boolean;
  dispatchToken: string;
}
/** Lease and schedule revisions are checked atomically with every content write. */
export function createVkLeaseFence(db: PrismaClient, groupId: string, token: string, now: () => Date, guard?: VkAutomationGuard) {
  return async (client: Prisma.TransactionClient = db) => {
    if (guard?.signal?.aborted || guard?.isCurrentSource?.() === false)
      throw new LostVkLease();
    const current = now();
    if (guard) {
      const dispatch = await client.vkAutomationRuntime.updateMany({ where: { id: 1, currentGroupId: groupId, leaseToken: guard.dispatchToken, leaseUntil: { gt: current } }, data: { leaseUntil: new Date(current.getTime() + VK_LEASE_MS) } });
      if (dispatch.count !== 1)
        throw new LostVkLease();
    }
    const changed = await client.vkImportSource.updateMany({ where: { groupId, leaseToken: token, leaseUntil: { gt: current }, ...(guard?.revision !== undefined ? { autoEnabled: true, autoRevision: guard.revision } : {}) }, data: { leaseUntil: new Date(current.getTime() + VK_LEASE_MS) } });
    if (changed.count !== 1)
      throw new LostVkLease();
  };
}
