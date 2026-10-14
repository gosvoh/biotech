import type { Prisma, PrismaClient } from "@/lib/db/client";

export const VK_LEASE_MS = 5 * 60 * 1000;
export class LostVkLease extends Error {}

/** Import and synchronization fence the same persistent source lease inside writes. */
export function createVkLeaseFence(db: PrismaClient, groupId: string, token: string, now: () => Date) {
  return async (client: Prisma.TransactionClient = db) => {
    const current = now();
    const changed = await client.vkImportSource.updateMany({
      where: { groupId, leaseToken: token, leaseUntil: { gt: current } },
      data: { leaseUntil: new Date(current.getTime() + VK_LEASE_MS) },
    });
    if (changed.count !== 1) throw new LostVkLease();
  };
}
