import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/lib/db/client";
import { applyVkPostBatch, type VkImportOptions } from "./importer";
import { createVkLeaseFence, LostVkLease, VK_LEASE_MS } from "./lease";
import { getVkApiErrorMessage } from "./client";
import type { VkHistoryState, VkPost } from "./types";

export class VkHistoryError extends Error {}
export interface VkHistoryOptions extends VkImportOptions {
  removeOldImages?: (images: { id: string }[]) => Promise<void>;
}
const FIRST_DAY = "2026-09-01";
function calendarDay(value: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new VkHistoryError("Укажите дату в формате ГГГГ-ММ-ДД.");
  const timestamp = Date.parse(`${value}T00:00:00+03:00`);
  if (!Number.isFinite(timestamp) || new Date(timestamp + 3 * 3600_000).toISOString().slice(0, 10) !== value) throw new VkHistoryError("Укажите существующую календарную дату.");
  return timestamp / 1000;
}
export async function listVkHistory(db: PrismaClient, groupId: string): Promise<VkHistoryState[]> {
  const [active, completed] = await Promise.all([
    db.vkHistoryJob.findMany({ where: { groupId, state: { not: "completed" } }, orderBy: { createdAt: "desc" } }),
    db.vkHistoryJob.findMany({ where: { groupId, state: "completed" }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const jobs = [...active, ...completed];
  return Promise.all(jobs.map((job) => historyState(db, job)));
}
type Job = NonNullable<Awaited<ReturnType<PrismaClient["vkHistoryJob"]["findUnique"]>>>;
async function historyState(db: PrismaClient, job: Job): Promise<VkHistoryState> {
  const counts = await db.vkHistoryPost.groupBy({ by: ["state", "outcome", "updated", "hidden", "restored"], where: { jobId: job.id }, _count: true });
  const count = (state: string, outcome?: string) => counts.filter((row) => row.state === state && (!outcome || row.outcome === outcome)).reduce((sum, row) => sum + row._count, 0);
  const effectedPending = counts.filter((row) => row.state === "pending" && (row.outcome === "added" || row.updated || row.hidden || row.restored)).reduce((sum, row) => sum + row._count, 0);
  const effects = (field: "updated" | "hidden" | "restored") => counts.filter((row) => row[field]).reduce((sum, row) => sum + row._count, 0);
  return { id: job.id, groupId: job.groupId, from: job.from, to: job.to, initial: job.initial,
    state: job.state as VkHistoryState["state"], processed: count("done") + count("failed") + effectedPending,
    added: count("done", "added") + count("failed", "added") + count("pending", "added"), updated: effects("updated"), hidden: effects("hidden"), restored: effects("restored"), skipped: count("done", "skipped"), failed: count("failed"), queued: count("pending"),
    lastSuccessAt: job.lastSuccessAt?.toISOString() ?? null, error: job.error };
}
export async function getVkHistory({ db }: VkImportOptions, id: string): Promise<VkHistoryState | null> {
  const job = await db.vkHistoryJob.findUnique({ where: { id } });
  return job ? historyState(db, job) : null;
}
export async function queueVkHistory(options: VkHistoryOptions, period: { from: string; to: string; initial?: boolean }): Promise<VkHistoryState> {
  const { db, api, now = () => new Date() } = options;
  if (!period || typeof period !== "object") throw new VkHistoryError("Укажите период истории.");
  calendarDay(period.from); calendarDay(period.to);
  const today = new Date(now().getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  if (period.from < FIRST_DAY || period.from > period.to || period.to > today) throw new VkHistoryError("Период должен начинаться не раньше 1 сентября 2026 года и заканчиваться не позже сегодняшнего дня по Москве.");
  if (period.initial && (period.from !== FIRST_DAY || period.to !== today)) throw new VkHistoryError("Первоначальная история загружается с 1 сентября по сегодняшний день по Москве.");
  let group;
  try { group = await api.getGroup(); } catch (error) { throw new VkHistoryError(getVkApiErrorMessage(error)); }
  const key = `${group.id}:${period.from}:${period.to}`;
  const job = await db.$transaction(async (tx) => {
    await tx.vkImportSource.upsert({ where: { groupId: group.id }, update: { name: group.name, screenName: group.screenName }, create: { groupId: group.id, name: group.name, screenName: group.screenName } });
    const data = { id: randomUUID(), groupId: group.id, from: period.from, to: period.to, initial: period.initial ?? false, ...(period.initial ? { initialKey: group.id } : { activeKey: key }) };
    return period.initial
      ? tx.vkHistoryJob.upsert({ where: { initialKey: group.id }, update: {}, create: data })
      : tx.vkHistoryJob.upsert({ where: { activeKey: key }, update: {}, create: data });
  });
  return historyState(db, job);
}

const HISTORY_ERRORS = {
  lease: "Проверка уже выполняется или была продолжена другим процессом. Продолжите историю позже.",
  page: "ВК вернул неполную страницу истории. Прогресс сохранён; повторите попытку.",
  missing: "Не удалось получить запись для повторной попытки. Прогресс сохранён.",
  storage: "Не удалось обработать часть истории. Прогресс сохранён; повторите попытку.",
};
function olderThan(post: VkPost, job: Job) {
  return job.anchorDate === null || post.date < job.anchorDate || (post.date === job.anchorDate && BigInt(post.id) < BigInt(job.anchorPostId!));
}
function descending(a: VkPost, b: VkPost) { return b.date - a.date || (BigInt(a.id) < BigInt(b.id) ? 1 : BigInt(a.id) > BigInt(b.id) ? -1 : 0); }

/** One durable wall page and at most thirty content applications; explicit continuation survives restart. */
export async function runVkHistoryBatch(options: VkHistoryOptions, id: string): Promise<VkHistoryState> {
  const { db, api, now = () => new Date() } = options;
  if (typeof id !== "string" || !id.trim()) throw new VkHistoryError("Операция истории не найдена.");
  let job = await db.vkHistoryJob.findUnique({ where: { id } });
  if (!job) throw new VkHistoryError("Операция истории не найдена.");
  let group;
  try { group = await api.getGroup(); } catch (error) { throw new VkHistoryError(getVkApiErrorMessage(error)); }
  if (group.id !== job.groupId) throw new VkHistoryError("Источник ВК изменился. Историю прежней группы продолжить нельзя.");
  if (job.state === "completed") return historyState(db, job);
  const token = randomUUID(), started = now();
  const fence = createVkLeaseFence(db, group.id, token, now);
  const claimed = await db.vkImportSource.updateMany({ where: { groupId: group.id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: started } }] }, data: { leaseToken: token, leaseUntil: new Date(started.getTime() + VK_LEASE_MS), name: group.name, screenName: group.screenName } });
  if (claimed.count !== 1) return { ...await historyState(db, job), error: HISTORY_ERRORS.lease };
  const lower = calendarDay(job.from), upper = calendarDay(job.to) + 86400;
  let batchError: string | null = null;
  let successfulPart = false;
  try {
    await db.$transaction(async (tx) => {
      await fence(tx);
      await tx.vkHistoryJob.update({ where: { id }, data: { state: "running", error: null } });
    });
    // Stored identities make an already observed page independent of later wall insertions.
    let work = await db.vkHistoryPost.findMany({ where: { jobId: id, state: { in: ["pending", "failed"] } }, orderBy: [{ attempts: "asc" }, { postId: "desc" }], take: 30 });
    if (!work.some((item) => item.state === "pending") && !job.exhausted) {
      await fence();
      const page = await api.getWall(group.id, job.scanOffset, 100);
      await fence();
      const expected = Math.min(100, Math.max(0, page.count - job.scanOffset));
      if (!Number.isSafeInteger(page.count) || page.count < 0 || page.items.length !== expected || new Set(page.items.map((post) => post.id)).size !== page.items.length
        || page.items.some((post) => !/^[1-9]\d*$/.test(post.id) || !Number.isSafeInteger(post.date))) throw new VkHistoryError(HISTORY_ERRORS.page);
      // Restart seeking when the wall shifts. Never trust a persisted numeric offset alone.
      if (job.scanOffset > 0 && job.scanCount !== null && page.count !== job.scanCount) {
        await db.$transaction(async (tx) => { await fence(tx); await tx.vkHistoryJob.update({ where: { id }, data: { scanOffset: 0, scanCount: page.count } }); });
      } else {
        const regular = page.items.filter((post) => !post.isPinned).sort(descending);
        const older = regular.filter((post) => olderThan(post, job!));
        const candidates = [...older, ...page.items.filter((post) => post.isPinned)].filter((post) => post.date >= lower && post.date < upper);
        const anchor = older.at(-1);
        const exhausted = regular.some((post) => post.date < lower) || job.scanOffset + page.items.length >= page.count;
        await db.$transaction(async (tx) => {
          await fence(tx);
          for (const post of candidates) {
            await tx.vkHistoryPost.upsert({ where: { jobId_postId: { jobId: id, postId: post.id } }, update: {}, create: { jobId: id, postId: post.id, snapshot: post as unknown as Prisma.InputJsonValue } });
          }
          await tx.vkHistoryJob.update({ where: { id }, data: {
            scanCount: page.count, exhausted,
            ...(anchor ? { anchorDate: anchor.date, anchorPostId: anchor.id, scanOffset: 0 } : { scanOffset: job!.scanOffset + 50 }),
          } });
        });
        successfulPart = true;
      }
      work = await db.vkHistoryPost.findMany({ where: { jobId: id, state: { in: ["pending", "failed"] } }, orderBy: [{ attempts: "asc" }, { postId: "desc" }], take: 30 });
    }
    const exclusions = await db.vkImportPost.findMany({ where: { groupId: group.id, postId: { in: work.map((item) => item.postId) }, OR: [{ manualDeleted: true }, { syncEnabled: false }] }, select: { postId: true } });
    const excluded = new Set(exclusions.map((item) => item.postId));
    const failed = work.filter((item) => item.state === "failed" && !excluded.has(item.postId));
    const retried = new Map<string, VkPost>();
    let retryFetchError: string | null = null;
    if (failed.length) {
      await fence();
      const requested = new Set(failed.map((item) => item.postId));
      try {
        const fetched = await api.getPosts(group.id, [...requested]);
        await fence();
        for (const post of fetched) if (requested.has(post.id) && post.ownerId === `-${group.id}` && post.date >= lower && post.date < upper && fetched.filter((item) => item.id === post.id).length === 1) retried.set(post.id, post);
      } catch (error) {
        if (error instanceof LostVkLease) throw error;
        retryFetchError = getVkApiErrorMessage(error);
      }
    }
    for (const item of work) {
      await fence();
      const post = item.state === "failed" ? retried.get(item.postId) : item.snapshot as unknown as VkPost;
      let error: string | null = null, outcome = item.outcome === "added" ? "added" : item.updated || item.hidden || item.restored ? "changed" : "skipped";
      if (excluded.has(item.postId)) { /* Explicit editor exclusions also settle prior update failures. */ }
      else if (!post) error = retryFetchError ?? HISTORY_ERRORS.missing;
      else {
        const result = await applyVkPostBatch(options, [post], { reconsiderSkipped: true, syncExisting: true, historyJobId: id, lease: { group, token } });
        error = result.successful ? null : result.error ?? HISTORY_ERRORS.storage;
        const applied = await db.vkHistoryPost.findUniqueOrThrow({ where: { jobId_postId: { jobId: id, postId: item.postId } } });
        outcome = applied.outcome === "added" ? "added" : applied.updated || applied.hidden || applied.restored ? "changed" : "skipped";
      }
      await db.$transaction(async (tx) => {
        await fence(tx);
        if (excluded.has(item.postId)) {
          const current = await tx.vkImportPost.findUnique({ where: { groupId_postId: { groupId: group.id, postId: item.postId } } });
          if (!current || (!current.manualDeleted && current.syncEnabled)) throw new VkHistoryError("Решения редактора изменились во время проверки. Повторите часть истории.");
        }
        await tx.vkHistoryPost.update({ where: { jobId_postId: { jobId: id, postId: item.postId } }, data: { state: error ? "failed" : "done", outcome: error && outcome === "skipped" ? null : outcome, error, attempts: { increment: 1 }, ...(post ? { snapshot: post as unknown as Prisma.InputJsonValue } : {}) } });
      });
      if (error) batchError ??= error;
      else successfulPart = true;
    }
    await db.$transaction(async (tx) => {
      await fence(tx);
      const current = await tx.vkHistoryJob.findUniqueOrThrow({ where: { id } });
      const remaining = await tx.vkHistoryPost.count({ where: { jobId: id, state: { not: "done" } } });
      const failures = await tx.vkHistoryPost.count({ where: { jobId: id, state: "failed" } });
      const completed = current.exhausted && remaining === 0;
      await tx.vkHistoryJob.update({ where: { id }, data: { state: completed ? "completed" : failures || batchError ? "waiting" : "queued", error: batchError ?? (failures ? HISTORY_ERRORS.storage : null), ...(completed ? { activeKey: null } : {}), ...(successfulPart ? { lastSuccessAt: now() } : {}) } });
    });
  } catch (error) {
    batchError = error instanceof LostVkLease ? HISTORY_ERRORS.lease : error instanceof VkHistoryError ? error.message : getVkApiErrorMessage(error);
    try {
      await db.$transaction(async (tx) => { await fence(tx); await tx.vkHistoryJob.update({ where: { id }, data: { state: "waiting", error: batchError } }); });
    } catch { /* The next owner alone may persist the resumed job state. */ }
  } finally {
    await db.vkImportSource.updateMany({ where: { groupId: group.id, leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
  }
  job = await db.vkHistoryJob.findUniqueOrThrow({ where: { id } });
  return { ...await historyState(db, job), ...(batchError ? { error: batchError } : {}) };
}
