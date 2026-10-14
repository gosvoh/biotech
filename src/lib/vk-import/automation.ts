import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/lib/db/client";
import { importVkNews } from "./importer";
import { syncVkNews } from "./sync";
import { listVkHistory, getVkHistory, runVkHistoryBatch, type VkHistoryOptions } from "./history";
import { recheckVkTags } from "./recheck";
import { getVkApiErrorMessage } from "./client";
import { VK_LEASE_MS, type VkAutomationGuard } from "./lease";
import type { VkAutomationState, VkGroup, VkImportResult } from "./types";
export type { VkAutomationState } from "./types";
export class VkAutomationError extends Error {
}
export interface VkAutomationOptions extends VkHistoryOptions {
  currentGroupId?: string;
  signal?: AbortSignal;
  isCurrentSource?: () => boolean;
}
const RETRY_MS = 60000, NEW_MS = 15 * 60000, SYNC_MS = 24 * 3600000;
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
function deadline(next: Date | null | undefined, last: Date | null | undefined, interval: number) {
  const success = last ? new Date(last.getTime() + interval) : null;
  return success && (!next || success > next) ? success : next ?? null;
}
/** Credentials are never needed to record worker liveness or detach a missing source. */
export async function heartbeatVkWorker(db: PrismaClient, options: {
  error?: string | null;
  currentGroupId?: string | null;
  now?: () => Date;
} = {}) {
  if (options.currentGroupId !== undefined)
    await selectSource(db, options.currentGroupId);
  await db.vkAutomationRuntime.upsert({ where: { id: 1 }, create: { id: 1, lastWorkerAt: options.now?.() ?? new Date(), lastError: options.error ?? null }, update: { lastWorkerAt: options.now?.() ?? new Date(), ...(options.error !== undefined ? { lastError: options.error } : {}) } });
}
export async function getVkAutomationState(db: PrismaClient, groupId?: string | null, now: () => Date = () => new Date()): Promise<VkAutomationState> {
  const runtime = await db.vkAutomationRuntime.findUnique({ where: { id: 1 } });
  const id = groupId === undefined ? runtime?.currentGroupId ?? null : groupId;
  const source = id ? await db.vkImportSource.findUnique({ where: { groupId: id } }) : null;
  const histories = id ? await listVkHistory(db, id) : [];
  const initialJob = id ? await db.vkHistoryJob.findUnique({ where: { initialKey: id } }) : null;
  const initial = initialJob ? await getVkHistory({ db }, initialJob.id) : null;
  return {
    groupId: id,
    enabled: source?.autoEnabled ?? false,
    initialHistoryId: initial?.id ?? null,
    initialState: initial,
    lastNewAt: iso(source?.lastSuccessAt),
    lastSyncAt: iso(source?.lastSyncAt),
    nextNewAt: iso(deadline(source?.nextNewAt, source?.lastSuccessAt, NEW_MS)),
    nextSyncAt: iso(deadline(source?.nextSyncAt, source?.lastSyncAt, SYNC_MS)),
    lastWorkerAt: iso(runtime?.lastWorkerAt),
    error: source?.lastAutomationError ?? (runtime?.currentGroupId === id ? runtime?.lastError : null) ?? null,
    running: Boolean(id !== null && runtime?.currentGroupId === id && runtime?.leaseToken && runtime.leaseUntil && runtime.leaseUntil > now()),
    manualCheckPending: Boolean(source && source.manualCheckRevision > source.manualCheckAppliedRevision),
    queued: Boolean(source && source.manualCheckRevision > source.manualCheckAppliedRevision) || histories.some(job => job.state !== "completed" && (!job.initial || source?.autoEnabled)),
  };
}
function assertCurrent(options: VkAutomationOptions) {
  if (options.signal?.aborted || options.isCurrentSource?.() === false)
    throw new Error("Источник изменился или исполнитель остановлен.");
}
async function selectSource(db: PrismaClient, id: string | null) {
  await db.$transaction(async (tx) => {
    // A different configured source revokes in-flight automatic content ownership.
    const old = await tx.vkAutomationRuntime.findUnique({ where: { id: 1 } });
    if (old?.currentGroupId && old.currentGroupId !== id) {
      await tx.vkImportSource.updateMany({ where: { groupId: old.currentGroupId }, data: { autoEnabled: false, autoRevision: { increment: 1 } } });
      await tx.vkImportSource.updateMany({ where: { groupId: old.currentGroupId, automationLeaseRevision: { not: null } }, data: { leaseToken: null, leaseUntil: null, automationLeaseRevision: null } });
    }
    await tx.vkAutomationRuntime.upsert({ where: { id: 1 }, create: { id: 1, currentGroupId: id }, update: { currentGroupId: id, ...(old?.currentGroupId !== id ? { leaseToken: null, leaseUntil: null, nextQueueAt: null, lastHistoryId: null } : {}) } });
  });
}
/** Probe access before making the editor's explicit enable durable. */
export async function enableVkAutomation(options: VkAutomationOptions): Promise<VkAutomationState> {
  const { db, api, now = () => new Date() } = options;
  let group: VkGroup;
  let expectedRevision: number | undefined;
  try {
    group = await api.getGroup();
    assertCurrent(options);
    expectedRevision = (await db.vkImportSource.findUnique({ where: { groupId: group.id } }))?.autoRevision;
    const page = await api.getWall(group.id, 0, 1);
    assertCurrent(options);
    if (!Number.isSafeInteger(page.count) || page.count < 0 || page.items.length !== Math.min(1, page.count) || page.items.some(p => p.ownerId !== `-${group.id}` || !Number.isSafeInteger(p.date)))
      throw new Error("Некорректный ответ ВК.");
  }
  catch (error) {
    throw new VkAutomationError(getVkApiErrorMessage(error));
  }
  if (options.currentGroupId && options.currentGroupId !== group.id)
    throw new VkAutomationError("Источник ВК изменился. Повторите включение.");
  await selectSource(db, group.id);
  const current = now(), today = new Date(current.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  await db.$transaction(async (tx) => {
    assertCurrent(options);
    const source = await tx.vkImportSource.upsert({ where: { groupId: group.id }, update: { name: group.name, screenName: group.screenName }, create: { groupId: group.id, name: group.name, screenName: group.screenName } });
    if (expectedRevision !== undefined && source.autoRevision !== expectedRevision)
      throw new VkAutomationError("Настройка расписания изменилась во время проверки. Повторите включение.");
    const initial = await tx.vkHistoryJob.upsert({ where: { initialKey: group.id }, update: {}, create: { id: randomUUID(), groupId: group.id, initialKey: group.id, initial: true, from: "2026-09-01", to: today, createdAt: current } });
    await tx.vkImportSource.update({ where: { groupId: group.id }, data: { autoEnabled: true, ...(!source.autoEnabled ? { autoRevision: { increment: 1 } } : {}), ...(source.cursorDate === null ? { cursorDate: Math.floor(initial.createdAt.getTime() / 1000) } : {}), nextNewAt: source.nextNewAt ?? current, nextSyncAt: source.nextSyncAt ?? current, nextHistoryAt: source.nextHistoryAt ?? current, lastAutomationError: null } });
  });
  return getVkAutomationState(db, group.id);
}
/** No token or remote access is needed to pause a known current source. */
export async function disableVkAutomation(db: PrismaClient, groupId: string): Promise<VkAutomationState> {
  await db.$transaction(async (tx) => {
    await tx.vkImportSource.updateMany({ where: { groupId }, data: { autoEnabled: false, autoRevision: { increment: 1 } } });
    await tx.vkImportSource.updateMany({ where: { groupId, automationLeaseRevision: { not: null } }, data: { leaseToken: null, leaseUntil: null, automationLeaseRevision: null } });
  });
  return getVkAutomationState(db, groupId);
}
/** Persist the editor request before attempting work, so a busy lease or restart cannot lose it. */
export async function checkVkLatest(options: VkAutomationOptions): Promise<VkImportResult> {
  const { db, api, now = () => new Date() } = options;
  const group = await api.getGroup();
  assertCurrent(options);
  if (options.currentGroupId && options.currentGroupId !== group.id)
    throw new VkAutomationError("Источник ВК изменился. Повторите проверку.");
  await selectSource(db, group.id);
  const source = await db.$transaction(async tx => {
    assertCurrent(options);
    return tx.vkImportSource.upsert({ where: { groupId: group.id },
      create: { groupId: group.id, name: group.name, screenName: group.screenName, manualCheckRevision: 1, nextManualCheckAt: now() },
      update: { manualCheckRevision: { increment: 1 }, nextManualCheckAt: now(), name: group.name, screenName: group.screenName },
    });
  });
  const dispatched = await dispatchVkAutomation({ ...options, currentGroupId: group.id });
  return dispatched.manualResult ?? {
    group, added: 0, skipped: 0, failed: 0, successful: false, queued: true,
    startedAt: now().toISOString(), finishedAt: now().toISOString(),
    lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null, error: null, reasons: [],
  };
}
/** Each dispatch executes due regular checks plus at most one bounded history and one tag pass. */
export async function tickVkAutomation(options: VkAutomationOptions): Promise<VkAutomationState> {
  return (await dispatchVkAutomation(options)).state;
}
async function dispatchVkAutomation(options: VkAutomationOptions): Promise<{ state: VkAutomationState; manualResult?: VkImportResult }> {
  const { db, api, now = () => new Date() } = options;
  assertCurrent(options);
  let id = options.currentGroupId;
  if (!id)
    id = (await api.getGroup()).id;
  await selectSource(db, id);
  const token = randomUUID(), started = now();
  const claimed = await db.vkAutomationRuntime.updateMany({ where: { id: 1, OR: [{ leaseUntil: null }, { leaseUntil: { lte: started } }] }, data: { leaseToken: token, leaseUntil: new Date(started.getTime() + VK_LEASE_MS), lastWorkerAt: started } });
  if (claimed.count !== 1)
    return { state: await getVkAutomationState(db, id, now) };
  const dispatchFence = async () => {
    assertCurrent(options);
    const changed = await db.vkAutomationRuntime.updateMany({ where: { id: 1, currentGroupId: id, leaseToken: token, leaseUntil: { gt: now() } }, data: { leaseUntil: new Date(now().getTime() + VK_LEASE_MS), lastWorkerAt: now() } });
    if (changed.count !== 1)
      throw new Error("Исполнитель уже продолжен другим процессом.");
  };
  const persistSchedule = async (revision: number, data: Prisma.VkImportSourceUpdateManyMutationInput) => {
    await db.$transaction(async (tx) => {
      assertCurrent(options);
      const owned = await tx.vkAutomationRuntime.updateMany({ where: { id: 1, currentGroupId: id, leaseToken: token, leaseUntil: { gt: now() } }, data: { lastWorkerAt: now() } });
      if (owned.count !== 1)
        throw new Error("Исполнитель уже продолжен другим процессом.");
      await tx.vkImportSource.updateMany({ where: { groupId: id, autoEnabled: true, autoRevision: revision }, data });
    });
  };
  let manualResult: VkImportResult | undefined;
  try {
    let source = await db.vkImportSource.findUnique({ where: { groupId: id } });
    const autoOptions = (): VkAutomationOptions => ({ ...options, api: { getWall: api.getWall.bind(api), getPosts: api.getPosts.bind(api), ...(api.lookupPosts ? { lookupPosts: api.lookupPosts.bind(api) } : {}), getGroup: async () => {
          await dispatchFence();
          const group = await api.getGroup();
          if (group.id !== id)
            throw new Error("Источник изменился.");
          return group;
        } }, automationGuard: { revision: source!.autoRevision, dispatchToken: token, signal: options.signal, isCurrentSource: options.isCurrentSource } satisfies VkAutomationGuard });
    const due = (value: Date | null) => !value || value <= now();
    if (source && source.manualCheckRevision > source.manualCheckAppliedRevision && due(source.nextManualCheckAt)) {
      const revision = source.manualCheckRevision;
      await dispatchFence();
      const manualOptions: VkAutomationOptions = {
        ...options,
        api: { getWall: api.getWall.bind(api), getPosts: api.getPosts.bind(api), ...(api.lookupPosts ? { lookupPosts: api.lookupPosts.bind(api) } : {}), getGroup: async () => {
          await dispatchFence();
          const group = await api.getGroup();
          if (group.id !== id) throw new VkAutomationError("Источник ВК изменился. Повторите проверку.");
          return group;
        } },
        automationGuard: { dispatchToken: token, signal: options.signal, isCurrentSource: options.isCurrentSource },
      };
      const startedAt = now().toISOString();
      const group: VkGroup = { id, name: source.name, screenName: source.screenName };
      const result: VkImportResult = await importVkNews(manualOptions).catch(error => ({
        group, added: 0, skipped: 0, failed: 0, successful: false, startedAt, finishedAt: now().toISOString(),
        lastSuccessAt: source!.lastSuccessAt?.toISOString() ?? null, error: getVkApiErrorMessage(error), reasons: [],
      }));
      // A failed new post does not prevent synchronization of existing publications.
      result.sync = await syncVkNews(manualOptions).catch(error => ({
        group, checked: 0, updated: 0, hidden: 0, restored: 0, failed: 0, successful: false,
        startedAt, finishedAt: now().toISOString(), error: getVkApiErrorMessage(error),
      }));
      result.successful = result.successful && result.sync.successful;
      result.error ??= result.sync.error;
      result.queued = !result.successful;
      await db.$transaction(async tx => {
        assertCurrent(options);
        const owned = await tx.vkAutomationRuntime.updateMany({ where: { id: 1, currentGroupId: id, leaseToken: token, leaseUntil: { gt: now() } }, data: { lastWorkerAt: now(), lastError: result.error } });
        if (owned.count !== 1) throw new VkAutomationError("Исполнитель уже продолжен другим процессом.");
        await tx.vkImportSource.updateMany({ where: { groupId: id }, data: {
          ...(result.successful ? { manualCheckAppliedRevision: revision } : {}),
          nextManualCheckAt: new Date(now().getTime() + (result.successful ? 1000 : RETRY_MS)),
        } });
      });
      manualResult = result;
      source = await db.vkImportSource.findUnique({ where: { groupId: id } });
    }
    if (!manualResult && source?.autoEnabled && due(deadline(source.nextNewAt, source.lastSuccessAt, NEW_MS))) {
      await dispatchFence();
      const result = await importVkNews(autoOptions()).catch(error => ({ successful: false, error: getVkApiErrorMessage(error) }));
      await persistSchedule(source.autoRevision, { nextNewAt: new Date(now().getTime() + (result.successful ? NEW_MS : RETRY_MS)), lastAutomationError: result.error });
    }
    source = await db.vkImportSource.findUnique({ where: { groupId: id } });
    if (!manualResult && source?.autoEnabled && due(deadline(source.nextSyncAt, source.lastSyncAt, SYNC_MS))) {
      await dispatchFence();
      const result = await syncVkNews(autoOptions()).catch(error => ({ successful: false, error: getVkApiErrorMessage(error) }));
      await persistSchedule(source.autoRevision, { nextSyncAt: new Date(now().getTime() + (result.successful ? SYNC_MS : RETRY_MS)), ...(result.error ? { lastAutomationError: result.error } : {}) });
    }
    source = await db.vkImportSource.findUnique({ where: { groupId: id } });
    const runtime = await db.vkAutomationRuntime.findUniqueOrThrow({ where: { id: 1 } });
    if (due(runtime.nextQueueAt)) {
      const initial = source?.autoEnabled && due(source.nextHistoryAt) ? await db.vkHistoryJob.findFirst({ where: { groupId: id, initial: true, state: { not: "completed" } } }) : null;
      const runnable = await db.vkHistoryJob.findMany({ where: { groupId: id, state: { not: "completed" }, OR: [{ initial: false }, ...(initial ? [{ id: initial.id }] : [])] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      const priorIndex = runnable.findIndex(job => job.id === runtime.lastHistoryId);
      const job = runnable.length ? runnable[(priorIndex + 1) % runnable.length] : null;
      const queuedOptions: VkAutomationOptions = { ...options, automationGuard: { dispatchToken: token, signal: options.signal, isCurrentSource: options.isCurrentSource } };
      let queueError: string | null = manualResult?.error ?? null;
      if (job) {
        await dispatchFence();
        const result = await runVkHistoryBatch(job.initial ? autoOptions() : queuedOptions, job.id);
        queueError = result.error;
        await db.vkAutomationRuntime.updateMany({ where: { id: 1, leaseToken: token }, data: { lastHistoryId: job.id } });
        if (job.initial)
          await persistSchedule(source!.autoRevision, { nextHistoryAt: new Date(now().getTime() + (result.error ? RETRY_MS : 1000)), ...(result.error ? { lastAutomationError: result.error } : {}) });
      }
      const catalog = await db.vkImportTagCatalog.findUnique({ where: { id: 1 } });
      if (catalog && catalog.revision > (source?.tagRecheckAppliedRevision ?? 0)) {
        await dispatchFence();
        const result = await recheckVkTags(queuedOptions);
        queueError ??= result.error;
      }
      await db.vkAutomationRuntime.updateMany({ where: { id: 1, leaseToken: token }, data: { nextQueueAt: new Date(now().getTime() + (queueError ? RETRY_MS : 1000)), lastError: queueError } });
    }
  }
  catch (error) {
    await db.vkAutomationRuntime.updateMany({ where: { id: 1, leaseToken: token }, data: { lastError: getVkApiErrorMessage(error), nextQueueAt: new Date(now().getTime() + RETRY_MS) } });
  }
  finally {
    await db.vkAutomationRuntime.updateMany({ where: { id: 1, leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
  }
  return { state: await getVkAutomationState(db, id, now), manualResult };
}
/** Heal committed public changes without credentials or content ownership.
 * A newer publication generation stays pending for the following worker pass.
 * Failures are represented by false; private cache/storage errors never escape.
 */
export async function healVkRevalidation(db: PrismaClient, invalidate: () => Promise<void> | void): Promise<boolean> {
  try {
    const pending = await db.vkImportSource.findMany({
      where: { needsRevalidate: true },
      select: { groupId: true, revalidationRevision: true },
    });
    if (!pending.length) return true;
    await invalidate();
    for (const source of pending) {
      await db.vkImportSource.updateMany({
        where: { groupId: source.groupId, revalidationRevision: source.revalidationRevision, needsRevalidate: true },
        data: { needsRevalidate: false },
      });
    }
    return true;
  } catch {
    return false;
  }
}
