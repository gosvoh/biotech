import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { importVkNews } from "./importer";
import { syncVkNews } from "./sync";
import { setNewsVisibility } from "./editor";
import { createNewsPhotoFiles } from "./news-files";
import type { PreparedVkImage, VkApi, VkGroup, VkImageStore, VkPost } from "./types";

let directory: string;
let db: PrismaClient;
const group: VkGroup = { id: "123", name: "Биотехнологии", screenName: "biotech.itmo" };
const baseDate = Date.parse("2026-09-02T12:00:00+03:00") / 1000;
let time: Date;
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
          writeFileSync(join(directory, id), photos[index].url);
          output.push({ id, sortOrder: index });
        }
        return output;
      } catch (error) {
        for (const item of output) unlinkSync(join(directory, item.id));
        throw error;
      }
    },
    discard: async (prepared) => { for (const item of prepared) if (existsSync(join(directory, item.id))) unlinkSync(join(directory, item.id)); },
  };
}
const runImport = (api: VkApi, store = images()) => importVkNews({ db, api, images: store, invalidate: () => {}, now: () => time });
const run = (api: VkApi, extra: Partial<Parameters<typeof syncVkNews>[0]> = {}) => syncVkNews({ db, api, images: images(), invalidate: () => {}, now: () => time, ...extra });
const news = () => db.news.findFirstOrThrow({ include: { images: { orderBy: { sortOrder: "asc" } }, tags: true, vkImport: true } });
const ledger = () => db.vkImportPost.findFirstOrThrow();

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-sync-"));
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
  time = new Date("2026-10-14T12:00:00Z");
});
afterAll(async () => {
  await db?.$disconnect();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-sync-"))) rmSync(directory, { recursive: true, force: true });
});

it("stores the original hashtag basis on first import", async () => {
  await runImport(wall([post(1)]));
  expect(await ledger()).toMatchObject({ selectionBasis: [{ name: "наука", tagId: "science" }], syncEnabled: true, manualHidden: false, manualDeleted: false });
});
it("atomically replaces the complete version and deletes prior VK files after commit", async () => {
  await runImport(wall([post(1, { photos: [{ url: "old" }] })]));
  const old = await news();
  const changed = post(1, { text: "Новое название\nНовый текст #Наука", photos: [{ url: "new-a" }, { url: "new-b" }] });
  expect(await run(wall([changed]))).toMatchObject({ successful: true, checked: 1, updated: 1 });
  const current = await news();
  expect(current).toMatchObject({ id: old.id, title: "Новое название", hidden: false, vkImport: { snapshot: changed, lastCheckedAt: time, lastCheckError: null } });
  expect(current.images).toHaveLength(2);
  expect(current.images.every((item) => existsSync(join(directory, item.id)))).toBe(true);
  expect(existsSync(join(directory, old.images[0].id))).toBe(false);
});
it("retains old content, tags, images and successful time when preparing one photo fails", async () => {
  await runImport(wall([post(1, { photos: [{ url: "old" }] })]));
  await run(wall([post(1, { photos: [{ url: "old" }] })]));
  const before = await news();
  time = new Date(time.getTime() + 1000);
  const result = await run(wall([post(1, { text: "Изменение #Наука", photos: [{ url: "a" }, { url: "b" }] })]), { images: images(1) });
  expect(result).toMatchObject({ successful: false, failed: 1, updated: 0 });
  expect(JSON.stringify(result)).not.toContain("VERY_SECRET");
  const after = await news();
  expect(after.title).toBe(before.title);
  expect(after.text).toBe(before.text);
  expect(after.images.map((item) => item.id)).toEqual(before.images.map((item) => item.id));
  expect(after.vkImport!.lastCheckedAt).toEqual(before.vkImport!.lastCheckedAt);
  expect(after.vkImport!.snapshot).toEqual(before.vkImport!.snapshot);
  expect(existsSync(join(directory, before.images[0].id))).toBe(true);
});
it("hides on loss of the last basis and restores only automatic hiding", async () => {
  await runImport(wall([post(1)]));
  expect(await run(wall([post(1, { text: "Новость без хештега" })]))).toMatchObject({ successful: true, hidden: 1 });
  expect(await news()).toMatchObject({ hidden: true, vkImport: { autoHiddenReason: expect.any(String) } });
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, restored: 1 });
  expect(await news()).toMatchObject({ hidden: false, vkImport: { autoHiddenReason: null } });
  await db.vkImportPost.update({ where: { groupId_postId: { groupId: group.id, postId: "1" } }, data: { manualHidden: true, revision: { increment: 1 } } });
  await db.news.updateMany({ data: { hidden: true } });
  await run(wall([post(1, { text: "Снова изменено #Наука" })]));
  expect(await news()).toMatchObject({ hidden: true, vkImport: { manualHidden: true } });
});
it.each(["rename", "delete"])("catalog %s alone keeps content and the saved original basis", async (action) => {
  await runImport(wall([post(1)]));
  const before = await news();
  if (action === "rename") await db.newsTags.update({ where: { id: "science" }, data: { title: "Новое", normalizedTitle: "новое" } });
  else await db.newsTags.delete({ where: { id: "science" } });
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, updated: 0, hidden: 0 });
  expect(await news()).toMatchObject({ title: before.title, hidden: false, vkImport: { selectionBasis: [{ name: "наука", tagId: "science" }] } });
  expect(await run(wall([post(1, { text: "Новый текст #Наука" })]))).toMatchObject({ successful: true, updated: 1 });
  expect(await news()).toMatchObject({ hidden: false, tags: action === "rename" ? [{ id: "science" }] : [] });
  expect(await run(wall([post(1, { text: "Теперь нет основания" })]))).toMatchObject({ hidden: 1 });
});
it("accumulates multiple old and new bases, preserving eligibility while any one survives", async () => {
  await runImport(wall([post(1)]));
  await db.newsTags.create({ data: { id: "study", title: "Учёба", normalizedTitle: "учёба" } });
  await run(wall([post(1, { text: "Первое изменение #Наука #Учёба" })]));
  expect((await ledger()).selectionBasis).toEqual([{ name: "наука", tagId: "science" }, { name: "учёба", tagId: "study" }]);
  await db.newsTags.deleteMany();
  expect(await run(wall([post(1, { text: "Второе изменение #Учёба" })]))).toMatchObject({ updated: 1, hidden: 0 });
  expect(await news()).toMatchObject({ hidden: false, tags: [] });
  expect(await run(wall([post(1, { text: "Без оснований" })]))).toMatchObject({ hidden: 1 });
});
it("counts all wall records and ignores an old pin when selecting exactly thirty", async () => {
  await runImport(wall([post(1), post(100), post(70)]));
  const posts = [post(1, { isPinned: true, text: "Изменённый старый #Наука" }), ...Array.from({ length: 31 }, (_, index) => post(100 - index, { text: "Не подходит", isRepost: true }))];
  const api = wall(posts);
  api.getWall = async (_, offset, count) => { expect(offset).toBe(0); expect(count).toBe(100); return { items: posts, count: posts.length }; };
  expect(await run(api)).toMatchObject({ checked: 1, hidden: 1 });
  expect((await db.news.findMany({ orderBy: { title: "asc" } })).find((item) => item.title === "Новость 1")!.hidden).toBe(false);
  expect((await db.vkImportSource.findFirstOrThrow()).recentPostIds).toEqual(Array.from({ length: 30 }, (_, index) => String(100 - index)));
});
it("exit from window alone is not deletion and ambiguous lookup preserves prior successful time", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1)]));
  const before = await ledger();
  time = new Date(time.getTime() + 1000);
  const newest = Array.from({ length: 31 }, (_, index) => post(100 - index));
  expect(await run(wall(newest))).toMatchObject({ successful: false, failed: 1, hidden: 0 });
  expect(await news()).toMatchObject({ hidden: false, vkImport: { lastCheckedAt: before.lastCheckedAt, lastCheckError: expect.any(String) } });
});
it("confirmed deletion hides and an addressed old restored post can return", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1)]));
  const api = wall([]);
  api.lookupPosts = async () => ({ items: [], deletedIds: ["1"], ambiguousIds: [] });
  expect(await run(api)).toMatchObject({ successful: true, hidden: 1 });
  expect(await news()).toMatchObject({ hidden: true, vkImport: { autoHiddenReason: "Оригинал удалён в ВК" } });
  const old = wall([]);
  old.getPosts = async () => [post(1)];
  expect(await run(old, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, restored: 1 });
  expect(await news()).toMatchObject({ hidden: false });
});
it("does not modify news on network failure, incomplete wall or an ambiguous addressed original", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1)]));
  const before = await news();
  for (const api of [
    { ...wall([]), getWall: async () => { throw new Error("secret"); } },
    { ...wall([]), getWall: async () => ({ items: [], count: 10 }) },
    { ...wall([]), lookupPosts: async () => ({ items: [], deletedIds: [], ambiguousIds: ["1"] }) },
  ]) {
    const result = await run(api);
    expect(result.successful).toBe(false);
    expect(await news()).toMatchObject({ hidden: false, title: before.title, vkImport: { lastCheckedAt: before.vkImport!.lastCheckedAt } });
  }
});
it("a changed configured source cannot check or modify a prior source", async () => {
  await runImport(wall([post(1)]));
  const other = { ...group, id: "456" };
  expect(await run(wall([post(1, { ownerId: "-456", fromId: "-456" })], other))).toMatchObject({ successful: true, checked: 0 });
  expect(await run(wall([], other), { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: false, checked: 0 });
  expect(await news()).toMatchObject({ hidden: false, title: "Новость 1" });
});
it("disabled sync keeps manual content; explicit re-enable prepares VK version and preserves manual hide", async () => {
  await runImport(wall([post(1)]));
  await db.vkImportPost.updateMany({ data: { syncEnabled: false, manualHidden: true, revision: { increment: 1 } } });
  await db.news.updateMany({ data: { title: "Ручной заголовок", text: "Ручной текст", hidden: true } });
  const api = wall([post(1, { text: "Версия ВК #Наука", photos: [{ url: "new" }] })]);
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ updated: 0 });
  expect(await news()).toMatchObject({ title: "Ручной заголовок", vkImport: { syncEnabled: false } });
  expect(await run(api, { target: { groupId: group.id, postId: "1", enableSync: true }, images: images(0) })).toMatchObject({ successful: false });
  expect(await news()).toMatchObject({ title: "Ручной заголовок", vkImport: { syncEnabled: false } });
  expect(await run(api, { target: { groupId: group.id, postId: "1", enableSync: true } })).toMatchObject({ successful: true, updated: 1 });
  expect(await news()).toMatchObject({ title: "Версия ВК", hidden: true, vkImport: { syncEnabled: true, manualHidden: true } });
});
it.each(["disable", "delete", "hide"])("a concurrent editor %s fences prepared version and old files", async (action) => {
  await runImport(wall([post(1, { photos: [{ url: "old" }] })]));
  const before = await news();
  const store = images();
  const prepare = store.prepare;
  let staged: PreparedVkImage[] = [];
  store.prepare = async (...args) => {
    staged = await prepare(...args);
    await db.vkImportPost.updateMany({ data: { revision: { increment: 1 }, ...(action === "disable" ? { syncEnabled: false } : action === "delete" ? { manualDeleted: true, newsId: null } : { manualHidden: true }) } });
    if (action === "delete") await db.news.deleteMany();
    else if (action === "hide") await db.news.updateMany({ data: { hidden: true } });
    return staged;
  };
  expect(await run(wall([post(1, { text: "Новая версия #Наука", photos: [{ url: "new" }] })]), { images: store })).toMatchObject({ updated: 0, successful: false, failed: 1 });
  expect(staged.every((item) => !existsSync(join(directory, item.id)))).toBe(true);
  expect((await ledger()).lastCheckError).toBe(null);
  if (action !== "delete") expect(await news()).toMatchObject({ title: before.title, images: [{ id: before.images[0].id }] });
  else expect(await db.news.count()).toBe(0);
});
it("manual deletion excludes repeat imports and sync until explicit restoration", async () => {
  await runImport(wall([post(1)]));
  await db.vkImportPost.updateMany({ data: { manualDeleted: true, revision: { increment: 1 } } });
  await db.news.deleteMany();
  expect(await runImport(wall([post(1)]))).toMatchObject({ added: 0 });
  expect(await run(wall([post(1)]))).toMatchObject({ updated: 0 });
  expect(await db.news.count()).toBe(0);
});
it("derives legacy basis from snapshot and existing tags; unknown basis never auto hides", async () => {
  await runImport(wall([post(1)]));
  await db.$executeRaw`UPDATE VkImportPost SET selectionBasis = NULL`;
  expect(await run(wall([post(1, { text: "Изменённый текст #Наука" })]))).toMatchObject({ updated: 1 });
  expect((await ledger()).selectionBasis).toEqual([{ name: "наука", tagId: "science" }]);
  await db.$executeRaw`UPDATE VkImportPost SET selectionBasis = NULL, snapshot = NULL`;
  const before = await news();
  expect(await run(wall([post(1, { text: "Нет основания" })]))).toMatchObject({ successful: false, hidden: 0 });
  expect(await news()).toMatchObject({ title: before.title, hidden: false, vkImport: { lastCheckError: expect.any(String) } });
});
it("cache failure retains new files and durable revalidation is retried", async () => {
  await runImport(wall([post(1)]));
  const api = wall([post(1, { text: "Новое #Наука", photos: [{ url: "new" }] })]);
  expect(await run(api, { invalidate: () => { throw new Error("cache"); } })).toMatchObject({ successful: false, updated: 1 });
  const current = await news();
  expect(current.images.every((item) => existsSync(join(directory, item.id)))).toBe(true);
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: true });
  expect(await run(api)).toMatchObject({ successful: true });
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: false });
});
it.each(["deleted", "ineligible"])("failed re-enable for %s original preserves the entire manual version and stays disabled", async (state) => {
  await runImport(wall([post(1)]));
  await db.vkImportPost.updateMany({ data: { syncEnabled: false, revision: { increment: 1 } } });
  await db.news.updateMany({ data: { title: "Ручная новость", text: "Текст сайта", hidden: false } });
  const api = wall(state === "ineligible" ? [post(1, { text: "Без основания" })] : []);
  if (state === "deleted") api.lookupPosts = async () => ({ items: [], deletedIds: ["1"], ambiguousIds: [] });
  expect(await run(api, { target: { groupId: group.id, postId: "1", enableSync: true } })).toMatchObject({ successful: false, updated: 0, hidden: 0 });
  expect(await news()).toMatchObject({ title: "Ручная новость", text: "Текст сайта", hidden: false, vkImport: { syncEnabled: false, autoHiddenReason: null, lastCheckedAt: time } });
});
it("a manual disabled check observes deletion without changing prior visibility or automatic reason", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1, { text: "Без основания" })]));
  const reason = (await ledger()).autoHiddenReason;
  await db.vkImportPost.updateMany({ data: { syncEnabled: false, revision: { increment: 1 } } });
  await db.news.updateMany({ data: { title: "Ручная версия", hidden: false } });
  const api = wall([]);
  api.lookupPosts = async () => ({ items: [], deletedIds: ["1"], ambiguousIds: [] });
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, hidden: 0, updated: 0 });
  expect(await news()).toMatchObject({ title: "Ручная версия", hidden: false, vkImport: { syncEnabled: false, autoHiddenReason: reason } });
});
it("a removed or duplicate lookup answer never proves deletion", async () => {
  await runImport(wall([post(1)]));
  for (const lookup of [
    { items: [], deletedIds: [], ambiguousIds: [] },
    { items: [post(1), post(1)], deletedIds: [], ambiguousIds: [] },
    { items: [post(1)], deletedIds: ["1"], ambiguousIds: [] },
    { items: [post(1, { ownerId: "-999" })], deletedIds: [], ambiguousIds: [] },
  ]) {
    const api = wall([]);
    api.lookupPosts = async () => lookup;
    expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: false, hidden: 0 });
    expect(await news()).toMatchObject({ hidden: false });
  }
});
it("lookup network failure records the addressed error without advancing successful time", async () => {
  await runImport(wall([post(1)]));
  const before = await ledger();
  time = new Date(time.getTime() + 1000);
  const api = wall([]);
  api.getPosts = async () => { throw new Error("access_token=VERY_SECRET"); };
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: false });
  expect(await ledger()).toMatchObject({ lastCheckedAt: before.lastCheckedAt, lastCheckError: expect.any(String) });
  expect(JSON.stringify(await ledger())).not.toContain("VERY_SECRET");
});
it("target lookup can republish an explicitly restored pending identity while preserving its manual hide", async () => {
  await runImport(wall([post(1)]));
  await db.news.deleteMany();
  await db.vkImportPost.updateMany({ data: { status: "pending", manualDeleted: false, manualHidden: true, revision: { increment: 1 } } });
  const api = wall([]);
  api.getPosts = async () => [post(1)];
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, updated: 1 });
  expect(await news()).toMatchObject({ hidden: true, vkImport: { newsId: expect.any(String), manualHidden: true } });
});
it("sync and initial import compete for the same durable lease", async () => {
  await runImport(wall([post(1)]));
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const api = wall([post(1, { text: "Изменение #Наука" })]);
  const original = api.getWall;
  api.getWall = async (...args) => { entered(); await waiting; return original(...args); };
  const first = run(api);
  await started;
  expect(await runImport(wall([post(2)]))).toMatchObject({ successful: false, added: 0 });
  release();
  expect(await first).toMatchObject({ successful: true, updated: 1 });
  expect(await db.news.count()).toBe(1);
});
it("expired sync cannot overwrite a newer owner or discard its committed files", async () => {
  await runImport(wall([post(1, { photos: [{ url: "old" }] })]));
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const store = images();
  const prepare = store.prepare;
  let staged: PreparedVkImage[] = [];
  store.prepare = async (photos) => { staged = await prepare(photos); entered(); await waiting; return staged; };
  const first = run(wall([post(1, { text: "Старая попытка #Наука", photos: [{ url: "stale" }] })]), { images: store });
  await started;
  time = new Date(time.getTime() + 6 * 60 * 1000);
  expect(await run(wall([post(1, { text: "Новый владелец #Наука", photos: [{ url: "current" }] })]))).toMatchObject({ successful: true, updated: 1 });
  release();
  expect(await first).toMatchObject({ successful: false, updated: 0 });
  expect(staged.every((item) => !existsSync(join(directory, item.id)))).toBe(true);
  const current = await news();
  expect(current.title).toBe("Новый владелец");
  expect(current.images.every((item) => existsSync(join(directory, item.id)))).toBe(true);
  expect(await db.vkImportSource.findFirst()).toMatchObject({ leaseToken: null, lastSyncError: null });
});
it("an explicit cleanup port removes prior manual photo files only after replacement commit", async () => {
  await runImport(wall([post(1)]));
  const current = await news();
  const manualId = "cmmanualphoto";
  writeFileSync(join(directory, manualId), "manual");
  await db.newsImages.create({ data: { id: manualId, newsId: current.id } });
  await db.vkImportPost.updateMany({ data: { syncEnabled: false, revision: { increment: 1 } } });
  expect(await run(wall([post(1)]), {
    target: { groupId: group.id, postId: "1", enableSync: true },
    removeOldImages: async (oldImages) => {
      expect((await news()).images).toEqual([]);
      for (const item of oldImages) unlinkSync(join(directory, item.id));
    },
  })).toMatchObject({ successful: true, updated: 1 });
  expect(existsSync(join(directory, manualId))).toBe(false);
});
it("restores an unchanged original using its complete saved version without downloading photos or changing catalog associations", async () => {
  const item = post(1, { photos: [{ url: "saved-photo" }] });
  await runImport(wall([item]));
  const before = await news();
  const missing = wall([]);
  missing.lookupPosts = async () => ({ items: [], deletedIds: ["1"], ambiguousIds: [] });
  await run(missing, { target: { groupId: group.id, postId: "1" } });
  await db.newsTags.update({ where: { id: "science" }, data: { title: "Переименовано", normalizedTitle: "переименовано" } });
  expect(await run(wall([item]), { images: images(0) })).toMatchObject({ successful: true, restored: 1, updated: 0 });
  expect(await news()).toMatchObject({ hidden: false, title: before.title, images: [{ id: before.images[0].id }], tags: [{ id: "science" }] });
});
it("initial import can republish a restored pending identity with renamed original basis and manual hide", async () => {
  await runImport(wall([post(1)]));
  await db.news.deleteMany();
  await db.vkImportPost.updateMany({ data: { status: "pending", manualDeleted: false, manualHidden: true, revision: { increment: 1 } } });
  await db.newsTags.update({ where: { id: "science" }, data: { title: "Новый фильтр", normalizedTitle: "новый" } });
  expect(await runImport(wall([post(1)]))).toMatchObject({ successful: true, added: 1 });
  expect(await news()).toMatchObject({ hidden: true, tags: [{ id: "science" }], vkImport: { selectionBasis: [{ name: "наука", tagId: "science" }] } });
});
it("initial import never publishes a version prepared before an editor deletion", async () => {
  const store = images();
  const prepare = store.prepare;
  let staged: PreparedVkImage[] = [];
  store.prepare = async (...args) => {
    staged = await prepare(...args);
    await db.vkImportPost.updateMany({ data: { manualDeleted: true, revision: { increment: 1 } } });
    return staged;
  };
  expect(await runImport(wall([post(1, { photos: [{ url: "new" }] })]), store)).toMatchObject({ successful: false, added: 0 });
  expect(await db.news.count()).toBe(0);
  expect(staged.every((item) => !existsSync(join(directory, item.id)))).toBe(true);
  expect(await runImport(wall([post(1)]))).toMatchObject({ successful: true, added: 0 });
});
it("an initial photo failure cannot overwrite the status of a newer editor decision", async () => {
  const store = images();
  store.prepare = async () => {
    await db.vkImportPost.updateMany({ data: { manualDeleted: true, status: "skipped", error: "Решение редактора", revision: { increment: 1 } } });
    throw new Error("photo-secret");
  };
  expect(await runImport(wall([post(1)]), store)).toMatchObject({ successful: false, added: 0 });
  expect(await ledger()).toMatchObject({ manualDeleted: true, status: "skipped", error: "Решение редактора" });
});
it("an addressed old post check preserves the last window-check timestamp and result", async () => {
  await runImport(wall([post(1)]));
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true });
  const windowCheck = await db.vkImportSource.findFirstOrThrow();
  time = new Date(time.getTime() + 5000);
  const api = wall([]);
  api.getPosts = async () => [post(1, { text: "Адресное обновление #Наука" })];
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, updated: 1 });
  expect(await news()).toMatchObject({ title: "Адресное обновление", vkImport: { lastCheckedAt: time } });
  expect(await db.vkImportSource.findFirst()).toMatchObject({
    lastSyncAt: windowCheck.lastSyncAt, lastSyncResult: windowCheck.lastSyncResult,
    lastSyncError: windowCheck.lastSyncError, leaseToken: null, leaseUntil: null,
  });
});
it("a still-existing original outside the new window preserves content until an addressed check", async () => {
  await runImport(wall([post(1, { photos: [{ url: "old-photo" }] })]));
  await run(wall([post(1, { photos: [{ url: "old-photo" }] })]));
  const before = await news();
  const changedOld = post(1, { text: "Изменено за пределами окна #Наука", photos: [{ url: "new-photo" }] });
  const latest = Array.from({ length: 31 }, (_, index) => post(100 - index));
  const api = wall(latest);
  api.getPosts = async () => [changedOld];
  time = new Date(time.getTime() + 5000);
  expect(await run(api)).toMatchObject({ successful: true, updated: 0, hidden: 0 });
  const outside = await news();
  expect(outside.title).toBe(before.title);
  expect(outside.text).toBe(before.text);
  expect(outside.images.map((item) => item.id)).toEqual(before.images.map((item) => item.id));
  expect(outside.vkImport!.snapshot).toEqual(before.vkImport!.snapshot);
  expect((await db.vkImportSource.findFirstOrThrow()).recentPostIds).toEqual(latest.slice(0, 30).map((item) => item.id));
  expect(await run(api, { target: { groupId: group.id, postId: "1" } })).toMatchObject({ successful: true, updated: 1 });
  expect(await news()).toMatchObject({ title: "Изменено за пределами окна", vkImport: { snapshot: changedOld } });
});
it.each(["sync", "importer"])("%s cache drain retains a newer editor invalidation committed during refresh", async (operation) => {
  await runImport(wall([post(1)]));
  const original = await news();
  const api = wall(operation === "sync" ? [post(1, { text: "Новый текст #Наука" })] : [post(2), post(1)]);
  const invalidate = async () => {
    await expect(setNewsVisibility({
      db, files: createNewsPhotoFiles({ directory }),
      invalidate: () => { throw new Error("editor-cache"); },
    }, original.id, true)).rejects.toThrow("кеш не обновлён");
  };
  if (operation === "sync") await run(api, { invalidate });
  else await importVkNews({ db, api, images: images(), invalidate, now: () => time });
  expect(await db.news.findUnique({ where: { id: original.id } })).toMatchObject({ hidden: true });
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: true });
  if (operation === "sync") expect(await run(api)).toMatchObject({ successful: true });
  else expect(await runImport(api)).toMatchObject({ successful: true });
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: false });
});
it("retries a confirmed deletion after a real failed hide even once the original leaves the remembered window", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1)]));
  const before = await ledger();
  const latest = Array.from({ length: 31 }, (_, index) => post(100 - index));
  const api = wall(latest);
  const requests: string[][] = [];
  api.lookupPosts = async (_, ids) => {
    requests.push([...ids]);
    return { items: latest.filter((item) => ids.includes(item.id)), deletedIds: ids.includes("1") ? ["1"] : [], ambiguousIds: [] };
  };
  await db.$executeRawUnsafe("CREATE TRIGGER fail_deleted_hide BEFORE UPDATE OF hidden ON News WHEN NEW.hidden = 1 BEGIN SELECT RAISE(ABORT, 'transient-hide'); END");
  try {
    expect(await run(api)).toMatchObject({ successful: false, hidden: 0, failed: 1 });
    expect(await news()).toMatchObject({ hidden: false, vkImport: { deletionRetry: true, deletionRetryAt: time, lastCheckedAt: before.lastCheckedAt } });
    expect((await db.vkImportSource.findFirstOrThrow()).recentPostIds).toEqual(latest.slice(0, 30).map((item) => item.id));
  } finally { await db.$executeRawUnsafe("DROP TRIGGER fail_deleted_hide"); }
  time = new Date(time.getTime() + 5000);
  expect(await run(api)).toMatchObject({ successful: true, hidden: 1 });
  expect(requests).toEqual([["1"], ["1"]]);
  expect(await news()).toMatchObject({ hidden: true, vkImport: { deletionRetry: false, deletionRetryAt: null, autoHiddenReason: "Оригинал удалён в ВК", lastCheckedAt: time } });
});
it("a pending deletion retry that becomes live outside the window clears the retry without applying changed content", async () => {
  await runImport(wall([post(1)]));
  await run(wall([post(1)]));
  const before = await news();
  await db.vkImportSource.updateMany({ data: { recentPostIds: [] } });
  await db.vkImportPost.updateMany({ data: { deletionRetry: true, deletionRetryAt: time, lastCheckError: "Предыдущий сбой" } });
  const changed = post(1, { text: "Правка старого поста #Наука" });
  const latest = Array.from({ length: 31 }, (_, index) => post(100 - index));
  const api = wall(latest);
  const requested: string[][] = [];
  api.getPosts = async (_, ids) => { requested.push(ids); return [changed]; };
  expect(await run(api)).toMatchObject({ successful: true, updated: 0, hidden: 0 });
  expect(requested).toEqual([["1"]]);
  expect(await news()).toMatchObject({ title: before.title, text: before.text, hidden: false, vkImport: { snapshot: before.vkImport!.snapshot, deletionRetry: false, deletionRetryAt: null, lastCheckError: null, lastCheckedAt: before.vkImport!.lastCheckedAt } });
});
it("an ambiguous pending deletion retry remains durable and records attempt time without hiding or advancing successful time", async () => {
  await runImport(wall([post(1)]));
  const before = await ledger();
  await db.vkImportSource.updateMany({ data: { recentPostIds: [] } });
  await db.vkImportPost.updateMany({ data: { deletionRetry: true, deletionRetryAt: time } });
  time = new Date(time.getTime() + 5000);
  const api = wall([]);
  const requests: string[][] = [];
  api.lookupPosts = async (_, ids) => { requests.push(ids); return { items: [], deletedIds: [], ambiguousIds: ids }; };
  expect(await run(api)).toMatchObject({ successful: false, hidden: 0, failed: 1 });
  expect(requests).toEqual([["1"]]);
  expect(await news()).toMatchObject({ hidden: false, vkImport: { deletionRetry: true, deletionRetryAt: time, lastCheckError: expect.any(String), lastCheckedAt: before.lastCheckedAt } });
});
it("bounds deletion-retry availability checks to sixty and rotates ambiguous attempts fairly", async () => {
  await runImport(wall(Array.from({ length: 30 }, (_, index) => post(30 - index))));
  await runImport(wall(Array.from({ length: 35 }, (_, index) => post(65 - index))));
  await db.vkImportSource.updateMany({ data: { recentPostIds: Array.from({ length: 30 }, (_, index) => String(65 - index)) } });
  await db.vkImportPost.updateMany({ where: { postId: { in: Array.from({ length: 35 }, (_, index) => String(index + 1)) } }, data: { deletionRetry: true, deletionRetryAt: time } });
  const successfulTimes = (await db.vkImportPost.findMany()).map((item) => [item.postId, item.lastCheckedAt]);
  const api = wall(Array.from({ length: 30 }, (_, index) => post(100 - index)));
  const requests: string[][] = [];
  api.lookupPosts = async (_, ids) => { requests.push([...ids]); return { items: [], deletedIds: [], ambiguousIds: ids }; };
  time = new Date(time.getTime() + 5000);
  expect(await run(api)).toMatchObject({ successful: false, hidden: 0 });
  time = new Date(time.getTime() + 5000);
  expect(await run(api)).toMatchObject({ successful: false, hidden: 0 });
  expect(requests.map((ids) => ids.length)).toEqual([60, 60]);
  expect(new Set(requests.flat()).size).toBe(65);
  expect(await db.news.count({ where: { hidden: true } })).toBe(0);
  expect(await db.vkImportPost.count({ where: { deletionRetry: true } })).toBe(35);
  expect((await db.vkImportPost.findMany()).map((item) => [item.postId, item.lastCheckedAt])).toEqual(successfulTimes);
});
