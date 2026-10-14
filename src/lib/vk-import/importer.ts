import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/lib/db/client";
import { getStoredVkSelectionBasis, prepareVkPost } from "./post";
import { VkApiError, getVkApiErrorMessage } from "./client";
import type { PreparedVkImage, VkApi, VkImageStore, VkImportResult, VkPost, VkGroup } from "./types";
import { createVkLeaseFence, LostVkLease as LostLease, VK_LEASE_MS as LEASE_MS } from "./lease";

import { syncVkNews } from "./sync";

export interface VkPostBatchLease { group: VkGroup; token: string }
interface ImportBatch extends VkPostBatchLease { posts: VkPost[]; reconsiderSkipped?: boolean; historyJobId?: string }

const PAGE_SIZE = 100;
const MAX_REASONS = 30;
const ERRORS = {
  incomplete: "ВК вернул неполную страницу записей. Позиция проверки сохранена; повторите попытку.",
  post: "Не удалось подготовить и сохранить запись. Она будет проверена повторно.",
  missing: "Не удалось получить запись для повторной попытки.",
  cache: "Новости сохранены, но кеш не обновлён. Повторите проверку.",
  lease: "Проверка уже выполняется или была продолжена другим процессом.",
  storage: "Не удалось сохранить результат проверки. Повторите проверку.",
};
class IncompleteWallPage extends Error {}

export interface VkImportOptions {
  db: PrismaClient;
  api: VkApi;
  images: VkImageStore;
  invalidate: () => Promise<void> | void;
  now?: () => Date;
}

/** Manual new-post import. All persistence is scoped to the canonical source. */
export async function importVkNews({ db, api, images, invalidate, now = () => new Date() }: VkImportOptions, batch?: ImportBatch): Promise<VkImportResult> {
  const startedAt = now();
  let group;
  try { group = batch?.group ?? await api.getGroup(); }
  catch (error) { throw new VkApiError(getVkApiErrorMessage(error)); }
  const result: VkImportResult = {
    group, added: 0, skipped: 0, failed: 0, successful: false,
    startedAt: startedAt.toISOString(), finishedAt: startedAt.toISOString(), lastSuccessAt: null, error: null, reasons: [],
  };
  const token = batch?.token ?? randomUUID();
  let owned = false;
  const reason = (postId: string, message: string) => {
    if (result.reasons.length < MAX_REASONS) result.reasons.push({ postId, reason: message });
  };
  // This write also serves as the fence: publication and lease verification share a transaction.
  const fence = createVkLeaseFence(db, group.id, token, now);
  const heartbeat = () => fence();
  const recordFailure = async (postId: string, message: string, revision: number) => {
    await db.$transaction(async (tx) => {
      await fence(tx);
      await tx.vkImportPost.updateMany({ where: { groupId: group.id, postId, revision, manualDeleted: false }, data: { status: "failed", error: message } });
    });
    result.failed++;
    reason(postId, message);
  };
  try {
    await db.vkImportSource.upsert({
      where: { groupId: group.id }, update: {},
      create: { groupId: group.id, name: group.name, screenName: group.screenName },
    });
    const previous = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
    result.lastSuccessAt = previous.lastSuccessAt?.toISOString() ?? null;
    if (!batch) {
    const claimed = await db.vkImportSource.updateMany({
      where: { groupId: group.id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: startedAt } }] },
      data: { leaseToken: token, leaseUntil: new Date(startedAt.getTime() + LEASE_MS), name: group.name, screenName: group.screenName, lastAttemptAt: startedAt },
    });
    if (claimed.count !== 1) { result.error = ERRORS.lease; return result; }
    owned = true;

    } else await heartbeat();

    // Resolve all wall/API pages before publishing: a failed page does not publish a partial scan.
    const candidates = new Map<string, VkPost>();
    let scanCursor = previous.cursorDate;
    try {
      if (batch) {
        for (const post of batch.posts) candidates.set(post.id, post);
      } else {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        await heartbeat();
        const page = await api.getWall(group.id, offset, PAGE_SIZE);
        const expected = Math.min(PAGE_SIZE, Math.max(0, page.count - offset));
        if (page.items.length !== expected) throw new IncompleteWallPage();
        await heartbeat();
        if (previous.cursorDate === null) {
          // An old pinned item appears first in wall.get; date sorting preserves the true latest thirty.
          for (const post of [...page.items].sort((a, b) => b.date - a.date || Number(b.id) - Number(a.id)).slice(0, 30)) candidates.set(post.id, post);
          break;
        }
        for (const post of page.items) if (post.date >= previous.cursorDate) candidates.set(post.id, post);
        if (!page.items.length || offset + page.items.length >= page.count || page.items.some((post) => !post.isPinned && post.date < previous.cursorDate!)) break;
      }
      scanCursor = [...candidates.values()].reduce((latest, post) => Math.max(latest, post.date), previous.cursorDate ?? 0) || previous.cursorDate;

      const retries = await db.vkImportPost.findMany({ where: { groupId: group.id, status: { in: ["failed", "pending"] }, manualDeleted: false }, select: { postId: true, revision: true } });
      const missing = retries.filter((item) => !candidates.has(item.postId));
      for (let offset = 0; offset < missing.length; offset += PAGE_SIZE) {
        await heartbeat();
        const requested = missing.slice(offset, offset + PAGE_SIZE);
        const fetched = await api.getPosts(group.id, requested.map((item) => item.postId));
        await heartbeat();
        const requestedIds = new Set(requested.map((item) => item.postId));
        for (const post of fetched) if (requestedIds.has(post.id)) candidates.set(post.id, post);
        for (const item of requested) if (!candidates.has(item.postId)) await recordFailure(item.postId, ERRORS.missing, item.revision);
      }
      }
    } catch (error) {
      if (error instanceof LostLease) throw error;
      result.error = error instanceof IncompleteWallPage ? ERRORS.incomplete : getVkApiErrorMessage(error);
      throw new Error(result.error);
    }

    const tags = await db.newsTags.findMany({ select: { id: true, title: true } });
    for (const post of [...candidates.values()].sort((a, b) => a.date - b.date || Number(a.id) - Number(b.id))) {
      await heartbeat();
      const key = { groupId: group.id, postId: post.id };
      const existing = await db.vkImportPost.findUnique({ where: { groupId_postId: key } });
      // The ledger intentionally survives deletion of a news row, so a deleted post cannot reappear.
      if (existing?.manualDeleted || existing?.status === "imported" || (existing?.status === "skipped" && !batch?.reconsiderSkipped) || existing?.syncEnabled === false) {
        result.skipped++;
        continue;
      }
      const preparedPost = prepareVkPost(post, group, tags, getStoredVkSelectionBasis(existing?.selectionBasis));
      const expectedRevision = existing?.revision ?? 0;
      await db.$transaction(async (tx) => {
        await fence(tx);
        if (existing) {
          const current = await tx.vkImportPost.findUnique({ where: { groupId_postId: key } });
          if (!current || current.manualDeleted || current.revision !== expectedRevision || current.newsId !== existing.newsId) throw new LostLease();
        }
        await tx.vkImportPost.upsert({
          where: { groupId_postId: key },
          create: { ...key, status: preparedPost.ok ? "pending" : "skipped", snapshot: post as unknown as Prisma.InputJsonValue, attempts: 1, error: preparedPost.ok ? null : preparedPost.reason },
          update: { status: preparedPost.ok ? "pending" : "skipped", snapshot: post as unknown as Prisma.InputJsonValue, attempts: { increment: 1 }, error: preparedPost.ok ? null : preparedPost.reason },
        });
      });
      if (!preparedPost.ok) { result.skipped++; reason(post.id, preparedPost.reason); continue; }
      let preparedImages: PreparedVkImage[] = [];
      let committed = false;
      try {
        preparedImages = await images.prepare(post.photos, heartbeat);
        await db.$transaction(async (tx) => {
          await fence(tx);
          const ledger = await tx.vkImportPost.findUniqueOrThrow({ where: { groupId_postId: key } });
          if (ledger.status !== "pending" || ledger.newsId !== null || ledger.manualDeleted || ledger.revision !== expectedRevision) throw new LostLease();
          const news = await tx.news.create({
            data: {
              title: preparedPost.title, text: preparedPost.text, date: preparedPost.date, links: preparedPost.links, hidden: ledger.manualHidden,
              tags: { connect: preparedPost.tagIds.map((id) => ({ id })) },
              images: { create: preparedImages.map((image) => ({ id: image.id, sortOrder: image.sortOrder })) },
            },
          });
          await tx.vkImportPost.update({ where: { groupId_postId: key }, data: { status: "imported", newsId: news.id, error: null, selectionBasis: preparedPost.selectionBasis as unknown as Prisma.InputJsonValue, autoHiddenReason: null, lastCheckedAt: now(), lastCheckError: null } });
          await tx.vkImportSource.update({ where: { groupId: group.id }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
          // Attribute creation in the same transaction as publication. A later
          // progress/cache failure can neither lose nor borrow this job's addition.
          if (batch?.historyJobId) {
            const recorded = await tx.vkHistoryPost.updateMany({
              where: { jobId: batch.historyJobId, postId: post.id, job: { groupId: group.id }, state: { in: ["pending", "failed"] } },
              data: { outcome: "added" },
            });
            if (recorded.count !== 1) throw new LostLease();
          }
        });
        committed = true;
        result.added++;
      } catch (error) {
        // Once committed, these files belong to the published news and must never be discarded.
        if (!committed && preparedImages.length) {
          try { await images.discard(preparedImages); } catch { /* Cleanup remains scoped to this attempt. */ }
        }
        if (error instanceof LostLease) throw error;
        await recordFailure(post.id, ERRORS.post, expectedRevision);
      }
    }
    if (!batch) {
    await db.$transaction(async (tx) => {
      await fence(tx);
      await tx.vkImportSource.update({ where: { groupId: group.id }, data: { cursorDate: scanCursor } });
    });
    }
    const current = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
    if (current.needsRevalidate) {
      await heartbeat();
      try { await invalidate(); }
      catch { result.error = ERRORS.cache; }
      if (!result.error) await db.$transaction(async (tx) => {
        await fence(tx);
        await tx.vkImportSource.updateMany({ where: { groupId: group.id, revalidationRevision: current.revalidationRevision }, data: { needsRevalidate: false } });
      });
    }
    if (result.failed && !result.error) result.error = "Некоторые записи не импортированы. Повторите проверку для новой попытки.";
    result.successful = result.failed === 0 && result.error === null;
  } catch (error) {
    result.error ??= error instanceof LostLease ? ERRORS.lease : ERRORS.storage;
    result.successful = false;
  } finally {
    result.finishedAt = now().toISOString();
    if (owned && !batch) {
      try {
        await db.$transaction(async (tx) => {
          await fence(tx);
          if (result.successful) result.lastSuccessAt = result.finishedAt;
          await tx.vkImportSource.update({
            where: { groupId: group.id },
            data: {
              ...(result.successful ? { lastSuccessAt: new Date(result.finishedAt) } : {}),
              lastError: result.error, lastResult: result as unknown as Prisma.InputJsonValue, leaseToken: null, leaseUntil: null,
            },
          });
        });
      } catch {
        result.successful = false;
        result.error = ERRORS.lease;
        const latest = await db.vkImportSource.findUnique({ where: { groupId: group.id } }).catch(() => null);
        result.lastSuccessAt = latest?.lastSuccessAt?.toISOString() ?? null;
      }
    }
  }
  return result;
}

/** Shared bounded application path. An inherited lease is never released or used for normal check statistics. */
export async function applyVkPostBatch(options: VkImportOptions, posts: VkPost[], settings: { reconsiderSkipped?: boolean; syncExisting?: boolean; historyJobId?: string; lease?: VkPostBatchLease } = {}): Promise<VkImportResult> {
  const { db, api, now = () => new Date() } = options;
  const group = settings.lease?.group ?? await api.getGroup();
  const token = settings.lease?.token ?? randomUUID();
  const started = now();
  const fence = createVkLeaseFence(db, group.id, token, now);
  let owned = false;
  try {
    if (!settings.lease) {
      await db.vkImportSource.upsert({ where: { groupId: group.id }, update: {}, create: { groupId: group.id, name: group.name, screenName: group.screenName } });
      const claimed = await db.vkImportSource.updateMany({ where: { groupId: group.id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: started } }] }, data: { leaseToken: token, leaseUntil: new Date(started.getTime() + LEASE_MS) } });
      if (claimed.count !== 1) return { group, added: 0, skipped: 0, failed: 0, successful: false, startedAt: started.toISOString(), finishedAt: now().toISOString(), lastSuccessAt: null, error: ERRORS.lease, reasons: [] };
      owned = true;
    }
    await fence();
    const result = await importVkNews(options, { group, token, posts: posts.slice(0, 30), reconsiderSkipped: settings.reconsiderSkipped, historyJobId: settings.historyJobId });
    if (settings.syncExisting && result.error !== ERRORS.lease) {
      const sync = await syncVkNews(options, { group, token, posts: posts.slice(0, 30), historyJobId: settings.historyJobId });
      result.sync = sync;
      result.failed += sync.failed;
      result.successful &&= sync.successful;
      result.error ??= sync.error;
    }
    return result;
  } finally {
    if (owned) await db.vkImportSource.updateMany({ where: { groupId: group.id, leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
  }
}
