import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { importVkNews, applyVkPostBatch } from "./importer";
import { syncVkNews } from "./sync";
import { setNewsVisibility, deleteNewsWithDecisions, disableVkSync } from "./editor";
import { createNewsPhotoFiles } from "./news-files";
import { queueVkHistory, runVkHistoryBatch, getVkHistory } from "./history";
import { listVkHistoryDetails } from "./history-details";
import type { PreparedVkImage, VkApi, VkGroup, VkImageStore, VkPost } from "./types";

let directory: string;
let db: PrismaClient;
const group: VkGroup = { id: "123", name: "Биотехнологии", screenName: "biotech.itmo" };
const baseDate = Date.parse("2026-09-02T12:00:00+03:00") / 1000;
const post = (id: number, overrides: Partial<VkPost> = {}): VkPost => ({
  id: String(id), ownerId: "-123", fromId: "-123", date: baseDate + id, text: `Новость ${id}\nПолный текст #Наука`,
  isRepost: false, isPinned: false, postType: "post", photos: [], ...overrides,
});
function wall(posts: VkPost[], source = group): VkApi {
  return { getGroup: async () => source, getWall: async (_, offset, count) => ({ items: posts.slice(offset, offset + count), count: posts.length }), getPosts: async (_, ids) => posts.filter((item) => ids.includes(item.id)) };
}
function images(failAt = -1): VkImageStore {
  let call = 0;
  return {
    prepare: async (photos, heartbeat) => {
      const output: PreparedVkImage[] = [];
      try {
        for (let index = 0; index < photos.length; index++) {
          await heartbeat?.();
          if (call++ === failAt) throw new Error("token=VERY_SECRET");
          const id = `vk-${randomUUID()}`;
          writeFileSync(join(directory, `${id}.webp`), photos[index].url);
          output.push({ id, sortOrder: index });
        }
        return output;
      } catch (error) {
        for (const item of output) unlinkSync(join(directory, `${item.id}.webp`));
        throw error;
      }
    },
    discard: async (prepared) => { for (const item of prepared) if (existsSync(join(directory, `${item.id}.webp`))) unlinkSync(join(directory, `${item.id}.webp`)); },
  };
}
const run = (api: VkApi, store = images(), invalidate: () => void | Promise<void> = () => {}) => importVkNews({ db, api, images: store, invalidate });

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-history-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
    env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => {
  await db.vkImportPost.deleteMany();
  await db.vkImportSource.deleteMany();
  await db.news.deleteMany();
  await db.newsTags.deleteMany();
  await db.newsTags.create({ data: { id: "science", title: "Наука", normalizedTitle: "наука" } });
});
afterAll(async () => {
  await db?.$disconnect();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-history-"))) rmSync(directory, { recursive: true, force: true });
});


const options = (api: VkApi, extra: Partial<Parameters<typeof importVkNews>[0]> = {}) => ({ db, api, images: images(), invalidate: () => {}, now: () => new Date("2026-10-14T12:00:00Z"), ...extra });
it("validates Moscow calendar dates and resumes the one initial job after restart", async () => {
  const opts = options(wall([]));
  await expect(queueVkHistory(opts, { from: "2026-08-31", to: "2026-09-02" })).rejects.toThrow();
  await expect(queueVkHistory(opts, { from: "2026-09-03", to: "2026-09-02" })).rejects.toThrow();
  await expect(queueVkHistory(opts, { from: "2026-09-31", to: "2026-10-02" })).rejects.toThrow();
  const queued = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-10-14", initial: true });
  expect(queued).toMatchObject({ state: "queued", from: "2026-09-01", to: "2026-10-14", processed: 0 });
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    expect((await queueVkHistory({ ...opts, db: independentDb, now: () => new Date("2026-10-15T12:00:00Z") }, { from: "2026-09-01", to: "2026-10-15", initial: true })).id).toBe(queued.id);
  } finally { await independentDb.$disconnect(); }
});

it("resumes thirty-post portions from durable pages and keeps exact Moscow boundaries", async () => {
  const start = Date.parse("2026-09-02T00:00:00+03:00") / 1000;
  const end = Date.parse("2026-09-03T00:00:00+03:00") / 1000;
  let posts = [post(900, { date: start - 1, isPinned: true }), post(901, { date: end }), ...Array.from({ length: 145 }, (_, i) => post(200-i, { date: start + 200-i })), post(1, { date: start })];
  let pages = 0;
  const api = wall([]);
  api.getWall = async (_, offset, count) => { pages++; return { items: posts.slice(offset, offset+count), count: posts.length }; };
  const opts = options(api);
  const job = await queueVkHistory(opts, { from: "2026-09-02", to: "2026-09-02" });
  let state = await runVkHistoryBatch(opts, job.id);
  expect(state).toMatchObject({ processed: 30, added: 30, failed: 0 });
  expect(pages).toBe(1);
  posts = [...Array.from({ length: 120 }, (_, i) => post(2000-i, { date: end + i })), ...posts];
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    for (let i = 0; i < 30 && state.state !== "completed"; i++) {
      const priorProcessed = state.processed, priorPages = pages;
      state = await runVkHistoryBatch({ ...opts, db: independentDb }, job.id);
      expect(state.processed-priorProcessed).toBeLessThanOrEqual(30);
      expect(pages-priorPages).toBeLessThanOrEqual(1);
    }
    expect(state).toMatchObject({ state: "completed", processed: 146, added: 146, skipped: 0, failed: 0 });
    expect((await getVkHistory({ ...opts, db: independentDb }, job.id))?.added).toBe(146);
    expect(await independentDb.news.count()).toBe(146);
    expect((await independentDb.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } })).cursorDate).toBeNull();
  } finally { await independentDb.$disconnect(); }
}, 30000);

it("keeps failed photo identities waiting until a bounded safe retry completes all photos", async () => {
  const item = post(5, { photos: [{ url: "a" }, { url: "b" }] });
  const api = wall([item]);
  const opts = options(api, { images: images(1) });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  const failed = await runVkHistoryBatch(opts, job.id);
  expect(failed).toMatchObject({ state: "waiting", processed: 1, added: 0, failed: 1 });
  expect(JSON.stringify(failed)).not.toContain("VERY_SECRET");
  expect(await db.news.count()).toBe(0);
  const ambiguous = { ...api, getPosts: async () => [] };
  expect(await runVkHistoryBatch(options(ambiguous), job.id)).toMatchObject({ state: "waiting", failed: 1, added: 0 });
  expect(await runVkHistoryBatch(options(api), job.id)).toMatchObject({ state: "completed", processed: 1, added: 1, failed: 0 });
  const result = await db.news.findFirstOrThrow({ include: { images: { orderBy: { sortOrder: "asc" } } } });
  expect(result.images).toHaveLength(2);
  expect(result.images.every((image) => existsSync(join(directory, `${image.id}.webp`)))).toBe(true);
});

it("continues the archive after a failed identity instead of starving later pages", async () => {
  const items = [post(999, { photos: [{ url: "broken" }] }), ...Array.from({ length: 125 }, (_, i) => post(500-i))];
  const store = images();
  const opts = options(wall(items), { images: { ...store, prepare: async (photos, heartbeat) => {
    if (photos.some((photo) => photo.url === "broken")) throw new Error("broken");
    return store.prepare(photos, heartbeat);
  } } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  let state = job;
  for (let i=0; i<12; i++) state = await runVkHistoryBatch(opts, job.id);
  expect(state).toMatchObject({ state: "waiting", processed: 126, added: 125, failed: 1 });
  expect(await db.news.count()).toBe(125);
}, 30000);

it("rechecks explicit history while retaining editor hide, deletion and disabled synchronization", async () => {
  const original = [post(4), post(3), post(2, { photos: [{ url: "deleted-original" }] }), post(1)];
  await run(wall(original));
  const records = await db.news.findMany({ include: { vkImport: true, images: true } });
  const byPost = (id: string) => records.find((item) => item.vkImport!.postId === id)!;
  const editor = { db, files: createNewsPhotoFiles({ directory }), invalidate: () => {} };
  await setNewsVisibility(editor, byPost("1").id, true);
  expect(existsSync(join(directory, `${byPost("2").images[0].id}.webp`))).toBe(true);
  await deleteNewsWithDecisions(editor, byPost("2").id);
  expect(existsSync(join(directory, `${byPost("2").images[0].id}.webp`))).toBe(false);
  await disableVkSync(editor, byPost("3").id);
  await db.news.update({ where: { id: byPost("3").id }, data: { title: "Редакторская версия" } });
  const changed = original.map((item) => ({ ...item, text: `Изменение ${item.id} #Наука` }));
  const opts = options(wall(changed));
  const sourceBefore = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
  const queued = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, queued.id)).toMatchObject({ state: "completed", processed: 4, added: 0, failed: 0 });
  expect(await db.news.findUnique({ where: { id: byPost("1").id } })).toMatchObject({ title: "Изменение 1", hidden: true });
  expect(await db.news.findUnique({ where: { id: byPost("2").id } })).toBeNull();
  expect(await db.news.findUnique({ where: { id: byPost("3").id } })).toMatchObject({ title: "Редакторская версия" });
  expect(await db.news.findUnique({ where: { id: byPost("4").id } })).toMatchObject({ title: "Изменение 4" });
  expect(await db.vkImportSource.findUnique({ where: { groupId: group.id } })).toMatchObject({ cursorDate: sourceBefore.cursorDate, lastResult: sourceBefore.lastResult, lastSyncAt: sourceBefore.lastSyncAt });
});
it("fixes a history job to its canonical source and lets a completed explicit period run again", async () => {
  const api = wall([post(1, { text: "Новое направление #Биология" })]);
  const opts = options(api);
  const queued = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect((await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" })).id).toBe(queued.id);
  const other = wall([post(1, { ownerId: "-456", fromId: "-456" })], { ...group, id: "456" });
  await expect(runVkHistoryBatch(options(other), queued.id)).rejects.toThrow("Источник ВК изменился");
  expect(await db.news.count()).toBe(0);
  expect(await runVkHistoryBatch(opts, queued.id)).toMatchObject({ state: "completed", skipped: 1 });
  await db.newsTags.create({ data: { title: "Биология", normalizedTitle: "биология" } });
  const rerun = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(rerun.id).not.toBe(queued.id);
  expect(await runVkHistoryBatch(opts, rerun.id)).toMatchObject({ state: "completed", added: 1 });
  expect(await db.news.count()).toBe(1);
  const otherJob = await queueVkHistory(options(other), { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(options(other), otherJob.id)).toMatchObject({ groupId: "456", state: "completed", added: 1 });
  expect(await db.news.count()).toBe(2);
});
it("shares the persistent source lease with normal import and fences an expired history owner", async () => {
  const api = wall([post(1)]);
  const opts = options(api);
  const queued = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const getWall = api.getWall;
  api.getWall = async (...args) => { enter(); await waiting; return getWall(...args); };
  const active = runVkHistoryBatch(opts, queued.id);
  await entered;
  try {
    expect(await importVkNews({ ...opts, api: wall([post(1)]) })).toMatchObject({ successful: false, added: 0 });
    expect((await runVkHistoryBatch({ ...opts, api: wall([post(1)]) }, queued.id)).error).toContain("выполняется");
    await db.vkImportSource.update({ where: { groupId: group.id }, data: { leaseUntil: new Date("2026-10-14T11:00:00Z") } });
    expect(await runVkHistoryBatch({ ...opts, api: wall([post(1)]) }, queued.id)).toMatchObject({ state: "completed", added: 1 });
  } finally { release(); }
  expect((await active).error).toContain("выполняется");
  expect(await db.news.count()).toBe(1);
  expect((await getVkHistory(opts, queued.id))?.state).toBe("completed");
});

it("preserves the old complete version and files when an editor decision changes during historical photo preparation", async () => {
  await run(wall([post(1, { photos: [{ url: "old" }] })]));
  const previous = await db.news.findFirstOrThrow({ include: { images: true } });
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => { enter=resolve; });
  const waiting = new Promise<void>((resolve) => { release=resolve; });
  const store = images();
  let staged: PreparedVkImage[] = [];
  const changed = post(1, { text: "Новая версия #Наука", photos: [{ url: "new-a" }, { url: "new-b" }] });
  const opts = options(wall([changed]), { images: { ...store, prepare: async (photos, heartbeat) => {
    staged = await store.prepare(photos, heartbeat);
    enter(); await waiting;
    return staged;
  } } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  const active = runVkHistoryBatch(opts, job.id);
  await entered;
  try {
    await setNewsVisibility({ db, files: createNewsPhotoFiles({ directory }), invalidate: () => {} }, previous.id, true);
  } finally { release(); }
  expect(await active).toMatchObject({ state: "waiting", failed: 1 });
  expect(await db.news.findUnique({ where: { id: previous.id } })).toMatchObject({ title: previous.title, hidden: true });
  expect(existsSync(join(directory, `${previous.images[0].id}.webp`))).toBe(true);
  expect(staged.every((photo) => !existsSync(join(directory, `${photo.id}.webp`)))).toBe(true);
  expect(await runVkHistoryBatch(options(wall([changed])), job.id)).toMatchObject({ state: "completed", failed: 0 });
  expect(await db.news.findUnique({ where: { id: previous.id } })).toMatchObject({ title: "Новая версия", hidden: true });
  expect(existsSync(join(directory, `${previous.images[0].id}.webp`))).toBe(false);
});
it("updates an existing published identity even when a different new post fails", async () => {
  await run(wall([post(1)]));
  const before = await db.news.findFirstOrThrow();
  const failedPost = post(9, { photos: [{ url: "broken" }] });
  const changed = post(1, { text: "Актуальная версия #Наука" });
  const store = images();
  const opts = options(wall([failedPost, changed]), { images: { ...store, prepare: async (photos, heartbeat) => {
    if (photos.some((photo) => photo.url === "broken")) throw new Error("broken");
    return store.prepare(photos, heartbeat);
  } } });
  expect(await applyVkPostBatch(opts, [failedPost, changed], { syncExisting: true, reconsiderSkipped: true })).toMatchObject({ successful: false, failed: 1, sync: { updated: 1 } });
  expect(await db.news.findUnique({ where: { id: before.id } })).toMatchObject({ title: "Актуальная версия" });
});

it("finishes a failed historical update as excluded after the editor deletes that news", async () => {
  await run(wall([post(1)]));
  const record = await db.news.findFirstOrThrow();
  const changed = post(1, { text: "Новая версия #Наука", photos: [{ url: "broken" }] });
  const opts = options(wall([changed]), { images: { ...images(), prepare: async () => { throw new Error("broken"); } } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ state: "waiting", failed: 1 });
  await deleteNewsWithDecisions({ db, files: createNewsPhotoFiles({ directory }), invalidate: () => {} }, record.id);
  const omitted = wall([]);
  omitted.getPosts = async () => { throw new Error("Excluded identities must not need a source retry"); };
  expect(await runVkHistoryBatch(options(omitted), job.id)).toMatchObject({ state: "completed", failed: 0, skipped: 1 });
  expect(await db.news.count()).toBe(0);
});

it("counts only additions published by this history job when another operation imports its pending identity", async () => {
  const posts = Array.from({ length: 35 }, (_, index) => post(134-index));
  const opts = options(wall(posts));
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ added: 30, processed: 30 });
  expect(await applyVkPostBatch(opts, [post(100)])).toMatchObject({ successful: true, added: 1 });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ state: "completed", added: 34, skipped: 1, processed: 35 });
  expect(await db.news.count()).toBe(35);
});

it("retains its own addition after publication succeeds but the lease expires before progress is journaled", async () => {
  let time = new Date("2026-10-14T12:00:00Z");
  let expireOnce = true;
  const opts = options(wall([post(1, { photos: [{ url: "complete" }] })]), {
    now: () => time,
    invalidate: () => { if (expireOnce) { expireOnce=false; time = new Date(time.getTime() + 6*60*1000); } },
  });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect((await runVkHistoryBatch(opts, job.id)).error).toContain("выполняется");
  expect(await db.news.count()).toBe(1);
  expect(await db.vkHistoryPost.findUniqueOrThrow({ where: { jobId_postId: { jobId: job.id, postId: "1" } } })).toMatchObject({ outcome: "added", reasonCode: "added", reasonText: "Новость добавлена на сайт" });
  const original = await db.news.findFirstOrThrow({ include: { images: true } });
  expect(existsSync(join(directory, `${original.images[0].id}.webp`))).toBe(true);
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    expect(await runVkHistoryBatch({ ...opts, db: independentDb }, job.id)).toMatchObject({ state: "completed", added: 1, skipped: 0, processed: 1 });
    expect(await independentDb.news.count()).toBe(1);
    expect(await independentDb.news.findFirst()).toMatchObject({ id: original.id });
  } finally { await independentDb.$disconnect(); }
});

it("reports its committed addition while cache refresh is waiting and does not add it twice on retry", async () => {
  const api = wall([post(1)]);
  const opts = options(api, { invalidate: () => { throw new Error("cache-secret"); } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ state: "waiting", processed: 1, added: 1, failed: 1 });
  expect(await db.news.count()).toBe(1);
  expect(await runVkHistoryBatch(options(api), job.id)).toMatchObject({ state: "completed", processed: 1, added: 1, failed: 0 });
  expect(await db.news.count()).toBe(1);
});

it("continues pending snapshots and later pages when the failed-identity lookup itself is unavailable", async () => {
  const items = [post(999, { photos: [{ url: "broken" }] }), ...Array.from({ length: 125 }, (_, i) => post(500-i))];
  const api = wall(items);
  api.getPosts = async () => { throw new Error("getById-token-secret"); };
  const store = images();
  const opts = options(api, { images: { ...store, prepare: async (photos, heartbeat) => {
    if (photos.some((photo) => photo.url === "broken")) throw new Error("broken");
    return store.prepare(photos, heartbeat);
  } } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  let state = job;
  for (let i = 0; i < 12; i++) state = await runVkHistoryBatch(opts, job.id);
  expect(state).toMatchObject({ state: "waiting", processed: 126, added: 125, failed: 1 });
  expect(JSON.stringify(state)).not.toContain("getById-token-secret");
  expect(await db.news.count()).toBe(125);
}, 30000);

it("reports historical content updates, automatic hides and restores as effects instead of skips", async () => {
  await run(wall([post(3), post(2), post(1)]));
  expect(await applyVkPostBatch(options(wall([])), [post(3, { text: "Новость 3 без основания" })], { syncExisting: true })).toMatchObject({ sync: { hidden: 1 } });
  const changed = [post(3), post(2, { text: "Новость 2 без основания" }), post(1, { text: "Новое содержание #Наука" })];
  const opts = options(wall(changed));
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ state: "completed", processed: 3, added: 0, updated: 2, hidden: 1, restored: 1, skipped: 0, failed: 0 });
  const current = await db.news.findMany({ include: { vkImport: true } });
  expect(current.find((item) => item.vkImport!.postId === "1")).toMatchObject({ title: "Новое содержание", hidden: false });
  expect(current.find((item) => item.vkImport!.postId === "2")).toMatchObject({ hidden: true });
  expect(current.find((item) => item.vkImport!.postId === "3")).toMatchObject({ hidden: false });
});

it.each(["updated", "hidden", "restored"] as const)("keeps its atomic %s effect after lease expiry and a restart without counting it twice", async (effect) => {
  await run(wall([post(1)]));
  if (effect === "restored") {
    const deleted = wall([]);
    deleted.lookupPosts = async () => ({ items: [], deletedIds: ["1"], ambiguousIds: [] });
    expect(await syncVkNews({ ...options(deleted), target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, hidden: 1 });
  }
  const changed = effect === "updated" ? post(1, { text: "Свежая версия #Наука" })
    : effect === "hidden" ? post(1, { text: "Версия без основания" }) : post(1);
  let time = new Date("2026-10-14T12:00:00Z"), expireOnce = true;
  const opts = options(wall([changed]), { now: () => time, invalidate: () => {
    if (expireOnce) { expireOnce=false; time = new Date(time.getTime() + 6*60*1000); }
  } });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  const interrupted = await runVkHistoryBatch(opts, job.id);
  expect(interrupted.error).toContain("выполняется");
  expect(interrupted).toMatchObject({ [effect]: 1, processed: 1, added: 0, skipped: 0 });
  expect(await db.vkHistoryPost.findUniqueOrThrow({ where: { jobId_postId: { jobId: job.id, postId: "1" } } })).toMatchObject({ reasonCode: effect, reasonText: expect.any(String) });
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    expect(await runVkHistoryBatch({ ...opts, db: independentDb }, job.id)).toMatchObject({ state: "completed", [effect]: 1, processed: 1, added: 0, skipped: 0, failed: 0 });
    expect((await getVkHistory({ ...opts, db: independentDb }, job.id))?.[effect]).toBe(1);
    expect(await independentDb.news.count()).toBe(1);
  } finally { await independentDb.$disconnect(); }
});

it.each([false, true])("persists all selection and editor reasons for initial=%s beyond thirty rows and after restart", async (initial) => {
  const posts = [post(1, { isRepost: true }), post(2, { text: "Нет тега" }), post(3, { text: "#Наука" }), post(4), post(5), ...Array.from({ length: 31 }, (_, i) => post(i + 10, { isRepost: true }))];
  await run(wall([post(4), post(5)]));
  await db.vkImportPost.update({ where: { groupId_postId: { groupId: group.id, postId: "4" } }, data: { manualDeleted: true } });
  await db.vkImportPost.update({ where: { groupId_postId: { groupId: group.id, postId: "5" } }, data: { syncEnabled: false } });
  const opts = options(wall(posts));
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-10-14", initial });
  await runVkHistoryBatch(opts, job.id);
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    expect(await runVkHistoryBatch({ ...opts, db: independentDb }, job.id)).toMatchObject({ state: "completed", skipped: 36, failed: 0 });
    const rows = await independentDb.vkHistoryPost.findMany({ where: { jobId: job.id } });
    expect(rows.every((row) => row.reasonCode && row.reasonText)).toBe(true);
    expect(rows.find((row) => row.postId === "1")?.reasonText).toContain("Репост");
    expect(rows.find((row) => row.postId === "2")?.reasonText).toContain("тег");
    expect(rows.find((row) => row.postId === "3")?.reasonText).toContain("текст");
    expect(rows.find((row) => row.postId === "4")?.reasonCode).toBe("manual_deleted");
    expect(rows.find((row) => row.postId === "5")?.reasonCode).toBe("sync_disabled");
  } finally { await independentDb.$disconnect(); }
});

it.each([false, true])("replaces a safe photo failure on %s existing publication with the successful retry", async (existing) => {
  if (existing) await run(wall([post(1)]));
  const changed = post(1, { text: "Обновление #Наука", photos: [{ url: "private-photo-url" }] });
  const opts = options(wall([changed]), { images: images(0) });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  expect(await runVkHistoryBatch(opts, job.id)).toMatchObject({ failed: 1 });
  const where = { jobId_postId: { jobId: job.id, postId: "1" } };
  const failed = await db.vkHistoryPost.findUniqueOrThrow({ where });
  expect(failed.reasonCode).toBe(existing ? "sync_failed" : "import_failed");
  expect(failed.reasonText).toContain("Не удалось");
  expect(failed.reasonText).toContain("фотографии");
  expect(failed.reasonText).not.toMatch(/VERY_SECRET|private-photo-url/);
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    expect(await runVkHistoryBatch({ ...options(wall([changed])), db: independentDb }, job.id)).toMatchObject({ failed: 0, state: "completed" });
    expect(await independentDb.vkHistoryPost.findUniqueOrThrow({ where })).toMatchObject({ error: null, reasonCode: existing ? "updated" : "added", reasonText: expect.not.stringContaining("Не удалось") });
  } finally { await independentDb.$disconnect(); }
});

it("replaces a prior photo reason when a retry fails before recording a current sync outcome", async () => {
  await run(wall([post(1)]));
  const changed = post(1, { text: "Обновление #Наука", photos: [{ url: "private-photo-url" }] });
  const opts = options(wall([changed]), { images: images(0) });
  const job = await queueVkHistory(opts, { from: "2026-09-01", to: "2026-09-03" });
  const beforeState = await runVkHistoryBatch(opts, job.id);
  const where = { jobId_postId: { jobId: job.id, postId: "1" } };
  const beforeRow = await db.vkHistoryPost.findUniqueOrThrow({ where });
  expect(beforeRow.reasonText).toContain("фотографии");
  const findMany = db.vkImportPost.findMany.bind(db.vkImportPost);
  let injected = false;
  const read = vi.spyOn(db.vkImportPost, "findMany").mockImplementation((args) => {
    // Exclusion lookup has OR; the first non-exclusion read is sync's
    // attemptedEntries query, before its per-entry reason recorder.
    if (!args?.where?.OR && !injected) {
      injected = true;
      throw new Error("TRANSIENT_DB_SECRET");
    }
    return findMany(args);
  });
  try {
    const afterState = await runVkHistoryBatch(options(wall([changed])), job.id);
    expect(injected).toBe(true);
    expect(afterState).toMatchObject({ processed: beforeState.processed, added: beforeState.added, updated: beforeState.updated, hidden: beforeState.hidden, restored: beforeState.restored, skipped: beforeState.skipped, failed: beforeState.failed });
    const afterRow = await db.vkHistoryPost.findUniqueOrThrow({ where });
    expect(afterRow).toMatchObject({ state: beforeRow.state, outcome: beforeRow.outcome, attempts: beforeRow.attempts + 1, reasonCode: "processing_failed", reasonText: afterState.error });
    expect(afterRow.reasonText).not.toMatch(/фотографии|TRANSIENT_DB_SECRET/);
    expect((await listVkHistoryDetails(db, { jobId: job.id, page: 1, filter: "failed" })).items[0].reasonText).toBe(afterState.error);
  } finally { read.mockRestore(); }
});
