import { randomUUID } from "node:crypto";
import { applyVkPostBatch, type VkImportOptions } from "./importer";
import { createVkLeaseFence, LostVkLease, VK_LEASE_MS } from "./lease";
import { getVkApiErrorMessage } from "./client";
import type { VkGroup } from "./types";
import type { Prisma, PrismaClient } from "@/lib/db/client";

export interface VkTagRecheckStatus {
  revision: number;
  appliedRevision: number;
  pending: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  error: string | null;
}

/** Save this signal in the same transaction as the catalogue edit. */
export async function markVkTagCatalogChanged(tx: Prisma.TransactionClient) {
  return tx.vkImportTagCatalog.upsert({
    where: { id: 1 }, create: { id: 1, revision: 1 }, update: { revision: { increment: 1 } },
  });
}

/** Remains readable even before the configured community is resolved. */
export async function getVkTagRecheckStatus(db: PrismaClient, groupId?: string): Promise<VkTagRecheckStatus> {
  const catalog = await db.vkImportTagCatalog.findUnique({ where: { id: 1 } });
  const source = groupId ? await db.vkImportSource.findUnique({ where: { groupId } }) : null;
  const revision = catalog?.revision ?? 0;
  const appliedRevision = source?.tagRecheckAppliedRevision ?? 0;
  return {
    revision, appliedRevision, pending: revision > appliedRevision,
    lastAttemptAt: catalog?.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: source?.lastTagRecheckAt?.toISOString() ?? null,
    error: revision > appliedRevision ? source?.lastTagRecheckError ?? catalog?.lastError ?? null : null,
  };
}

export interface VkTagRecheckResult extends VkTagRecheckStatus {
  group: VkGroup | null;
  checked: number;
  added: number;
  skipped: number;
  failed: number;
  successful: boolean;
}

const ERRORS = {
  lease: "Пересмотр тегов ожидает завершения другой проверки ВК.",
  incomplete: "ВК вернул неполную страницу записей. Пересмотр тегов будет повторён.",
  storage: "Не удалось сохранить пересмотр тегов. Изменения каталога сохранены для повтора.",
  cache: "Изменения сохранены, но кеш тегов и новостей не обновлён. Пересмотр будет повторён.",
};

/** Reconsider only the newest thirty; catalogue changes never hide existing publications. */
export async function recheckVkTags(options: VkImportOptions): Promise<VkTagRecheckResult> {
  const { db, api, now = () => new Date(), automationGuard } = options;
  const queued = await getVkTagRecheckStatus(db);
  const result: VkTagRecheckResult = { ...queued, group: null, checked: 0, added: 0, skipped: 0, failed: 0, successful: false, error: null };
  if (!queued.pending) return { ...result, successful: true };
  await db.vkImportTagCatalog.updateMany({ where: { id: 1, revision: queued.revision }, data: { lastAttemptAt: now() } });
  let group: VkGroup;
  try { group = await api.getGroup(); }
  catch (error) {
    result.error = getVkApiErrorMessage(error);
    await db.vkImportTagCatalog.updateMany({ where: { id: 1, revision: queued.revision }, data: { lastError: result.error } });
    return result;
  }
  result.group = group;
  await db.vkImportTagCatalog.updateMany({ where: { id: 1, revision: queued.revision }, data: { lastError: null } });
  await db.vkImportSource.upsert({ where: { groupId: group.id }, update: { name: group.name, screenName: group.screenName }, create: { groupId: group.id, name: group.name, screenName: group.screenName } });
  const previous = await getVkTagRecheckStatus(db, group.id);
  result.appliedRevision = previous.appliedRevision;
  if (previous.appliedRevision >= queued.revision) return { ...result, ...previous, successful: true };
  const token = randomUUID();
  const fence = createVkLeaseFence(db, group.id, token, now, automationGuard);
  const started = now();
  const claimed = await db.vkImportSource.updateMany({
    where: { groupId: group.id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: started } }] },
    data: { leaseToken: token, leaseUntil: new Date(started.getTime() + VK_LEASE_MS), automationLeaseRevision: automationGuard?.revision ?? null },
  });
  if (claimed.count !== 1) return { ...result, error: ERRORS.lease };
  try {
    await fence();
    const page = await api.getWall(group.id, 0, 100);
    await fence();
    if (!Number.isSafeInteger(page.count) || page.count < 0 || page.items.length !== Math.min(100, page.count)
      || new Set(page.items.map((post) => post.id)).size !== page.items.length
      || page.items.some((post) => !Number.isSafeInteger(post.date))) {
      result.error = ERRORS.incomplete;
    } else {
      const posts = [...page.items].sort((a, b) => b.date - a.date || Number(b.id) - Number(a.id)).slice(0, 30);
      const applied = await applyVkPostBatch(options, posts, { reconsiderSkipped: true, lease: { group, token } });
      result.checked = posts.length;
      result.added = applied.added;
      result.skipped = applied.skipped;
      result.failed = applied.failed;
      result.error = applied.error;
      result.successful = applied.successful;
      if (result.successful) {
        await fence();
        try { await options.invalidate(); }
        catch { result.successful = false; result.error = ERRORS.cache; }
      }
    }
  } catch (error) {
    result.error = error instanceof LostVkLease ? ERRORS.lease : getVkApiErrorMessage(error);
  } finally {
    try {
      await db.$transaction(async (tx) => {
        await fence(tx);
        const catalog = await tx.vkImportTagCatalog.findUniqueOrThrow({ where: { id: 1 } });
        const finished = now();
        result.revision = catalog.revision;
        result.appliedRevision = result.successful ? queued.revision : previous.appliedRevision;
        result.pending = result.revision > result.appliedRevision;
        result.lastAttemptAt = catalog.lastAttemptAt?.toISOString() ?? null;
        result.lastSuccessAt = result.successful ? finished.toISOString() : previous.lastSuccessAt;
        await tx.vkImportSource.update({ where: { groupId: group.id }, data: {
          ...(result.successful ? { tagRecheckAppliedRevision: queued.revision, lastTagRecheckAt: finished } : {}),
          lastTagRecheckError: result.error, lastTagRecheckResult: result as unknown as Prisma.InputJsonValue,
          leaseToken: null, leaseUntil: null, automationLeaseRevision: null,
        } });
        await tx.vkImportTagCatalog.updateMany({ where: { id: 1, revision: queued.revision }, data: { lastError: null } });
      });
    } catch {
      result.successful = false;
      result.error = ERRORS.storage;
    }
  }
  await db.vkImportSource.updateMany({ where: { groupId: group.id, leaseToken: token }, data: { leaseToken: null, leaseUntil: null, automationLeaseRevision: null } });
  const final = await getVkTagRecheckStatus(db, group.id);
  return { ...result, ...final, error: result.error ?? final.error };
}
