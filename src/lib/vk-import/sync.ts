import { randomUUID } from "node:crypto";
import type { Prisma } from "@/lib/db/client";
import { VkApiError, getVkApiErrorMessage } from "./client";
import type { VkImportOptions, VkPostBatchLease } from "./importer";
import { createVkLeaseFence, LostVkLease, VK_LEASE_MS } from "./lease";
import { getStoredVkSelectionBasis as readBasis, getVkSelectionBasis, prepareVkPost } from "./post";
import type { PreparedVkImage, VkPost, VkPostLookup, VkSyncResult } from "./types";

export interface VkSyncOptions extends VkImportOptions {
  target?: { groupId: string; postId: string; enableSync?: boolean };
  /** Deletes prior news-owned files, including manual photos, only after commit. */
  removeOldImages?: (images: { id: string }[]) => Promise<void>;
}

const ERRORS = {
  lease: "Проверка уже выполняется или была продолжена другим процессом.",
  changed: "Решения редактора изменились во время проверки. Повторите проверку.",
  ambiguous: "Не удалось однозначно проверить оригинал в ВК. Предыдущая версия сохранена.",
  incomplete: "ВК вернул неполную страницу записей. Предыдущая версия сохранена.",
  prepare: "Не удалось подготовить и сохранить новую версию. Предыдущая версия сохранена.",
  basis: "Основание старой публикации неизвестно. Автоматическое скрытие не выполнено.",
  cache: "Новости сохранены, но кеш не обновлён. Повторите проверку.",
  cleanup: "Новая версия сохранена, но прежние фотографии не удалось удалить.",
  source: "Оригинал относится к другому источнику ВК. Проверка не выполнена.",
  missingLedger: "Импортированная запись не найдена.",
};
class EditorChanged extends Error {}
class SyncError extends Error {}


function readRecentIds(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^[1-9]\d*$/.test(id)))].slice(0, 30) : [];
}
function readPost(value: Prisma.JsonValue | null): VkPost | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value.text === "string" && Array.isArray(value.photos) && typeof value.id === "string" ? value as unknown as VkPost : null;
}
function sameVersion(a: VkPost | null, b: VkPost): boolean {
  if (!a) return false;
  const content = (post: VkPost) => [post.id, post.ownerId, post.fromId, post.date, post.text, post.isRepost, post.postType, post.photos];
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

/** Synchronizes existing identities only; no archive crawl or implicit deletion proof. */
export async function syncVkNews({ db, api, images, invalidate, now = () => new Date(), target, removeOldImages }: VkSyncOptions, batch?: VkPostBatchLease & { posts: VkPost[]; historyJobId?: string }): Promise<VkSyncResult> {
  const startedAt = now();
  let group;
  try { group = batch?.group ?? await api.getGroup(); }
  catch (error) { throw new VkApiError(getVkApiErrorMessage(error)); }
  const result: VkSyncResult = {
    group, checked: 0, updated: 0, hidden: 0, restored: 0, failed: 0, successful: false,
    startedAt: startedAt.toISOString(), finishedAt: startedAt.toISOString(), error: null,
  };
  if (target && target.groupId !== group.id) return { ...result, error: ERRORS.source };
  const token = batch?.token ?? randomUUID();
  const fence = createVkLeaseFence(db, group.id, token, now);
  const heartbeat = () => fence();
  let owned = false;
  let windowIds: string[] | null = null;
  let attemptedEntries: Entry[] = [];
  type Entry = NonNullable<Awaited<ReturnType<typeof db.vkImportPost.findUnique>>>;
  const guarded = async (tx: Prisma.TransactionClient, expected: Entry) => {
    await fence(tx);
    const current = await tx.vkImportPost.findUnique({ where: { groupId_postId: { groupId: group.id, postId: expected.postId } } });
    if (!current || current.revision !== expected.revision || current.manualDeleted || current.newsId !== expected.newsId || current.syncEnabled !== expected.syncEnabled) throw new EditorChanged();
    return current;
  };
  const recordEffects = async (tx: Prisma.TransactionClient, postId: string, effects: { updated?: boolean; hidden?: boolean; restored?: boolean; added?: boolean }) => {
    if (!batch?.historyJobId) return;
    const data = { ...(effects.updated ? { updated: true } : {}), ...(effects.hidden ? { hidden: true } : {}), ...(effects.restored ? { restored: true } : {}), ...(effects.added ? { outcome: "added" } : {}) };
    if (!Object.keys(data).length) return;
    const recorded = await tx.vkHistoryPost.updateMany({
      where: { jobId: batch.historyJobId, postId, job: { groupId: group.id }, state: { in: ["pending", "failed"] } }, data,
    });
    if (recorded.count !== 1) throw new LostVkLease();
  };
  const failure = async (entry: Entry, message: string, confirmedDeletion = false) => {
    result.failed++;
    result.error ??= message;
    await db.$transaction(async (tx) => {
      await fence(tx);
      await tx.vkImportPost.updateMany({
        where: { groupId: group.id, postId: entry.postId, revision: entry.revision, manualDeleted: false },
        data: {
          lastCheckError: message,
          ...(confirmedDeletion && entry.syncEnabled && entry.newsId
            ? { deletionRetry: true, deletionRetryAt: now() }
            : entry.deletionRetry ? { deletionRetryAt: now() } : {}),
        },
      });
    });
  };
  try {
    await db.vkImportSource.upsert({ where: { groupId: group.id }, update: {}, create: { groupId: group.id, name: group.name, screenName: group.screenName } });
    const previous = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
    if (!batch) {
    const claimed = await db.vkImportSource.updateMany({
      where: { groupId: group.id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: startedAt } }] },
      data: { leaseToken: token, leaseUntil: new Date(startedAt.getTime() + VK_LEASE_MS), name: group.name, screenName: group.screenName },
    });
    if (claimed.count !== 1) return { ...result, error: ERRORS.lease };
    owned = true;
    } else await heartbeat();
    // Only failed applications of a previously confirmed deletion enter this bounded queue.
    // Old content remains outside daily synchronization even when availability is retried.
    const deletionRetries = target || batch ? [] : await db.vkImportPost.findMany({
      where: { groupId: group.id, deletionRetry: true, manualDeleted: false, syncEnabled: true, newsId: { not: null }, news: { isNot: null } },
      orderBy: [{ deletionRetryAt: "asc" }, { postId: "asc" }], take: 30,
    });
    attemptedEntries = await db.vkImportPost.findMany({ where: {
      groupId: group.id, postId: { in: target ? [target.postId] : [...new Set([...readRecentIds(previous.recentPostIds), ...deletionRetries.map((entry) => entry.postId)])] },
    } });
    const found = new Map<string, VkPost>();
    const deleted = new Set<string>();
    const outsideLive = new Set<string>();
    const ambiguous = new Set<string>();
    let requested: string[];
    if (batch) {
      for (const post of batch.posts) found.set(post.id, post);
      requested = [];
    } else if (target) requested = [target.postId];
    else {
      await heartbeat();
      const page = await api.getWall(group.id, 0, 100);
      const expected = Math.min(100, page.count);
      if (!Number.isSafeInteger(page.count) || page.count < 0 || page.items.length !== expected
        || new Set(page.items.map((item) => item.id)).size !== page.items.length
        || page.items.some((item) => !Number.isSafeInteger(item.date))) throw new SyncError(ERRORS.incomplete);
      await heartbeat();
      const current = [...page.items].sort((a, b) => b.date - a.date || Number(b.id) - Number(a.id)).slice(0, 30);
      windowIds = current.map((item) => item.id);
      for (const item of current) found.set(item.id, item);
      requested = [...new Set([...readRecentIds(previous.recentPostIds), ...deletionRetries.map((entry) => entry.postId)])].filter((id) => !found.has(id));
    }
    attemptedEntries = await db.vkImportPost.findMany({ where: {
      groupId: group.id, postId: { in: [...new Set([...found.keys(), ...requested])] },
    } });
    if (requested.length) {
      await heartbeat();
      let lookup: VkPostLookup;
      if (api.lookupPosts) lookup = await api.lookupPosts(group.id, requested);
      else lookup = { items: await api.getPosts(group.id, requested), deletedIds: [], ambiguousIds: [] };
      await heartbeat();
      for (const id of requested) {
        const candidates = lookup.items.filter((item) => item.id === id);
        const confirmsDeletion = lookup.deletedIds.filter((item) => item === id).length === 1;
        if (lookup.ambiguousIds.includes(id) || candidates.length > 1 || (candidates.length && confirmsDeletion)) ambiguous.add(id);
        else if (candidates.length === 1 && candidates[0].ownerId === `-${group.id}`) {
          found.set(id, candidates[0]);
          // Outside the daily window, lookup confirms existence only. Content needs an explicit target check.
          if (!target) outsideLive.add(id);
        }
        else if (!candidates.length && confirmsDeletion) deleted.add(id);
        else ambiguous.add(id);
      }
      // Keep the prior observed window available for a safe retry after ambiguity.
      if (ambiguous.size) windowIds = null;
    }
    const ids = [...new Set([...found.keys(), ...deleted, ...ambiguous])];
    const entries = await db.vkImportPost.findMany({ where: { groupId: group.id, postId: { in: ids } } });
    if (target && !entries.length) throw new SyncError(ERRORS.missingLedger);
    for (const entry of entries) {
      await heartbeat();
      if (entry.manualDeleted || (!entry.newsId && entry.status !== "pending")) continue;
      const key = { groupId: group.id, postId: entry.postId };
      const force = target?.postId === entry.postId && target.enableSync === true;
      try {
        if (outsideLive.has(entry.postId)) {
          if (entry.deletionRetry || entry.lastCheckError) await db.$transaction(async (tx) => {
            await guarded(tx, entry);
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: { deletionRetry: false, deletionRetryAt: null, lastCheckError: null } });
          });
          continue;
        }
        if (ambiguous.has(entry.postId)) { await failure(entry, ERRORS.ambiguous); continue; }
        const item = found.get(entry.postId);
        if (!entry.syncEnabled && !force) {
          // A manual check can record a successful observation without applying source state.
          await db.$transaction(async (tx) => {
            await guarded(tx, entry);
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: { lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null } });
          });
          result.checked++;
          continue;
        }
        if (deleted.has(entry.postId)) {
          if (force && !entry.syncEnabled) { await failure(entry, "Оригинал удалён в ВК. Синхронизация остаётся выключенной."); continue; }
          const hidden = await db.$transaction(async (tx) => {
            await guarded(tx, entry);
            const news = entry.newsId ? await tx.news.findUnique({ where: { id: entry.newsId } }) : null;
            if (news) await tx.news.update({ where: { id: news.id }, data: { hidden: true } });
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: { autoHiddenReason: "Оригинал удалён в ВК", lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null, revision: { increment: 1 } } });
            if (news && !news.hidden) await tx.vkImportSource.update({ where: { groupId: group.id }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
            const changed = Boolean(news && !news.hidden);
            await recordEffects(tx, entry.postId, { hidden: changed });
            return changed;
          });
          result.checked++;
          if (hidden) result.hidden++;
          continue;
        }
        if (!item) { await failure(entry, ERRORS.ambiguous); continue; }
        const snapshot = readPost(entry.snapshot);
        const oldNews = entry.newsId ? await db.news.findUnique({ where: { id: entry.newsId }, include: { tags: true, images: { orderBy: { sortOrder: "asc" } } } }) : null;
        let basis = readBasis(entry.selectionBasis);
        if (!basis.length && snapshot && oldNews) basis = getVkSelectionBasis(snapshot.text, group, oldNews.tags);
        if (sameVersion(snapshot, item) && oldNews && !force && !entry.autoHiddenReason) {
          await db.$transaction(async (tx) => {
            await guarded(tx, entry);
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: {
              lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null,
              ...(basis.length && !readBasis(entry.selectionBasis).length ? { selectionBasis: basis as unknown as Prisma.InputJsonValue } : {}),
            } });
          });
          result.checked++;
          continue;
        }
        const tags = await db.newsTags.findMany({ select: { id: true, title: true } });
        const prepared = prepareVkPost(item, group, tags, basis);
        if (prepared.ok && sameVersion(snapshot, item) && oldNews && !force) {
          const restored = await db.$transaction(async (tx) => {
            const current = await guarded(tx, entry);
            const currentNews = await tx.news.findUniqueOrThrow({ where: { id: oldNews.id } });
            const hidden = current.manualHidden;
            await tx.news.update({ where: { id: currentNews.id }, data: { hidden } });
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: {
              autoHiddenReason: null, lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null, revision: { increment: 1 },
              ...(basis.length && !readBasis(entry.selectionBasis).length ? { selectionBasis: basis as unknown as Prisma.InputJsonValue } : {}),
            } });
            if (currentNews.hidden !== hidden) await tx.vkImportSource.update({ where: { groupId: group.id }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
            await recordEffects(tx, entry.postId, { restored: currentNews.hidden && !hidden, hidden: !currentNews.hidden && hidden });
            return currentNews.hidden && !hidden;
          });
          result.checked++;
          if (restored) result.restored++;
          continue;
        }
        if (!prepared.ok) {
          if (force && !entry.syncEnabled) { await failure(entry, `${prepared.reason}. Синхронизация остаётся выключенной.`); continue; }
          if (!basis.length) { await failure(entry, ERRORS.basis); continue; }
          const hidden = await db.$transaction(async (tx) => {
            await guarded(tx, entry);
            const currentNews = entry.newsId ? await tx.news.findUnique({ where: { id: entry.newsId } }) : null;
            if (currentNews) await tx.news.update({ where: { id: currentNews.id }, data: { hidden: true } });
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: {
              snapshot: item as unknown as Prisma.InputJsonValue, selectionBasis: basis as unknown as Prisma.InputJsonValue,
              autoHiddenReason: prepared.reason, lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null, revision: { increment: 1 },
            } });
            if (currentNews && !currentNews.hidden) await tx.vkImportSource.update({ where: { groupId: group.id }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
            const changed = Boolean(currentNews && !currentNews.hidden);
            await recordEffects(tx, entry.postId, { hidden: changed });
            return changed;
          });
          result.checked++;
          if (hidden) result.hidden++;
          continue;
        }
        let staged: PreparedVkImage[] = [];
        let committed = false;
        try {
          staged = await images.prepare(item.photos, heartbeat);
          const outcome = await db.$transaction(async (tx) => {
            const current = await guarded(tx, entry);
            const data = {
              title: prepared.title, text: prepared.text, date: prepared.date, links: prepared.links,
              hidden: current.manualHidden,
              tags: { connect: prepared.tagIds.map((id) => ({ id })) },
              images: { create: staged.map((image) => ({ id: image.id, sortOrder: image.sortOrder })) },
            };
            const news = current.newsId
              ? await tx.news.update({ where: { id: current.newsId }, data: { ...data, tags: { set: prepared.tagIds.map((id) => ({ id })) }, images: { deleteMany: {}, create: data.images.create } } })
              : await tx.news.create({ data });
            await tx.vkImportPost.update({ where: { groupId_postId: key }, data: {
              newsId: news.id, status: "imported", snapshot: item as unknown as Prisma.InputJsonValue,
              selectionBasis: prepared.selectionBasis as unknown as Prisma.InputJsonValue, autoHiddenReason: null,
              syncEnabled: true, lastCheckedAt: now(), lastCheckError: null, deletionRetry: false, deletionRetryAt: null, error: null, revision: { increment: 1 },
            } });
            await tx.vkImportSource.update({ where: { groupId: group.id }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
            const outcome = { restored: Boolean(oldNews?.hidden && !news.hidden), hidden: Boolean(oldNews && !oldNews.hidden && news.hidden) };
            await recordEffects(tx, entry.postId, { ...outcome, updated: Boolean(current.newsId), added: !current.newsId });
            return outcome;
          });
          committed = true;
          result.checked++;
          result.updated++;
          if (outcome.restored) result.restored++;
          if (outcome.hidden) result.hidden++;
          if (oldNews?.images.length) {
            try {
              if (removeOldImages) await removeOldImages(oldNews.images.map(({ id }) => ({ id })));
              else await images.discard(oldNews.images.map(({ id, sortOrder }) => ({ id, sortOrder })));
            } catch { result.error ??= ERRORS.cleanup; }
          }
        } catch (error) {
          if (!committed && staged.length) {
            try { await images.discard(staged); } catch { /* Only this unpublished attempt owns these files. */ }
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof LostVkLease) throw error;
        await failure(entry, error instanceof EditorChanged ? ERRORS.changed : ERRORS.prepare, deleted.has(entry.postId));
      }
    }
    const completedWindow = windowIds;
    if (completedWindow) await db.$transaction(async (tx) => {
      await fence(tx);
      await tx.vkImportSource.update({ where: { groupId: group.id }, data: { recentPostIds: completedWindow } });
    });
    const source = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
    if (source.needsRevalidate) {
      await heartbeat();
      try {
        await invalidate();
        await db.$transaction(async (tx) => {
          await fence(tx);
          await tx.vkImportSource.updateMany({ where: { groupId: group.id, revalidationRevision: source.revalidationRevision }, data: { needsRevalidate: false } });
        });
      } catch (error) {
        if (error instanceof LostVkLease) throw error;
        result.error ??= ERRORS.cache;
      }
    }
    result.successful = result.failed === 0 && result.error === null;
  } catch (error) {
    result.error ??= error instanceof LostVkLease ? ERRORS.lease : error instanceof SyncError ? error.message : getVkApiErrorMessage(error);
    if (owned && !(error instanceof LostVkLease)) {
      for (const entry of attemptedEntries.filter((item) => !item.manualDeleted)) {
        try { await failure(entry, result.error); } catch { break; }
      }
    }
  } finally {
    result.finishedAt = now().toISOString();
    if (owned && !batch) {
      try {
        await db.$transaction(async (tx) => {
          await fence(tx);
          await tx.vkImportSource.update({ where: { groupId: group.id }, data: {
            ...(!target ? {
              ...(result.successful ? { lastSyncAt: new Date(result.finishedAt) } : {}),
              lastSyncError: result.error, lastSyncResult: result as unknown as Prisma.InputJsonValue,
            } : {}),
            leaseToken: null, leaseUntil: null,
          } });
        });
      } catch { result.successful = false; result.error = ERRORS.lease; }
    }
  }
  return result;
}
