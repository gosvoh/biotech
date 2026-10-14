import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { getVkTagRecheckStatus, markVkTagCatalogChanged, recheckVkTags } from "./recheck";
import type { VkApi, VkGroup, VkImageStore, VkPost } from "./types";
import { deleteNewsWithDecisions, disableVkSync, setNewsVisibility } from "./editor";
import { createNewsPhotoFiles } from "./news-files";

let directory: string;
let db: PrismaClient;
const group: VkGroup = { id: "123", name: "Биотехнологии", screenName: "biotech.itmo" };
const baseDate = Date.parse("2026-09-02T12:00:00+03:00") / 1000;
const post = (id: number, overrides: Partial<VkPost> = {}): VkPost => ({
  id: String(id), ownerId: "-123", fromId: "-123", date: baseDate + id,
  text: `Новость ${id}\nПолный текст #Наука`, isRepost: false, isPinned: false, postType: "post", photos: [], ...overrides,
});
function wall(posts: VkPost[], source = group): VkApi {
  return { getGroup: async () => source, getWall: async (_, offset, count) => ({ items: posts.slice(offset, offset + count), count: posts.length }), getPosts: async () => { throw new Error("Tag recheck must not crawl identities outside the window"); } };
}
const images: VkImageStore = {
  prepare: async (photos, heartbeat) => {
    await heartbeat?.();
    return photos.map((photo, sortOrder) => {
      const id = randomUUID();
      writeFileSync(join(directory, id), photo.url);
      return { id, sortOrder };
    });
  },
  discard: async (prepared) => { for (const image of prepared) if (existsSync(join(directory, image.id))) unlinkSync(join(directory, image.id)); },
};
const run = (api: VkApi) => recheckVkTags({ db, api, images, invalidate: () => {} });
const changed = () => db.$transaction((tx) => markVkTagCatalogChanged(tx));

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-tags-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
    env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => {
  await db.vkImportTagCatalog.deleteMany();
  await db.vkImportPost.deleteMany();
  await db.vkImportSource.deleteMany();
  await db.news.deleteMany();
  await db.newsTags.deleteMany();
});
afterAll(async () => {
  await db?.$disconnect();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-tags-"))) rmSync(directory, { recursive: true, force: true });
});

it("keeps a queued catalogue change without a configured or previously resolved source", async () => {
  await changed();
  expect(await getVkTagRecheckStatus(db)).toMatchObject({ revision: 1, appliedRevision: 0, pending: true, lastSuccessAt: null });
});

it("reconsiders skipped and never imported posts only in the latest thirty by date, excluding an old pin", async () => {
  await db.newsTags.create({ data: { id: "science", title: "Наука", normalizedTitle: "наука" } });
  await db.vkImportSource.create({ data: { groupId: group.id, name: group.name, screenName: group.screenName } });
  await db.vkImportPost.create({ data: { groupId: group.id, postId: "100", status: "skipped", error: "Нет подходящего тега" } });
  await changed();
  const api = wall([post(1, { isPinned: true }), ...Array.from({ length: 60 }, (_, index) => post(100 - index))]);
  const original = api.getWall;
  api.getWall = async (...args) => {
    if (args[1] !== 0) throw new Error("Tag recheck must not crawl wall history");
    return original(...args);
  };
  expect(await run(api)).toMatchObject({ successful: true, checked: 30, added: 30, pending: false, appliedRevision: 1 });
  expect((await db.news.findMany({ include: { vkImport: true }, orderBy: { title: "asc" } })).map((news) => news.vkImport?.postId).sort((a, b) => Number(a) - Number(b)))
    .toEqual(Array.from({ length: 30 }, (_, index) => String(71 + index)));
});

it("retains the generation after a photo failure and completes after restart without duplicate publication", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  const api = wall([post(1, { photos: [{ url: "first" }, { url: "second" }] })]);
  const failedImages: VkImageStore = { ...images, prepare: async () => { throw new Error("token=VERY_SECRET"); } };
  const failed = await recheckVkTags({ db, api, images: failedImages, invalidate: () => {} });
  expect(failed).toMatchObject({ successful: false, pending: true, failed: 1, appliedRevision: 0, lastSuccessAt: null });
  expect(JSON.stringify(failed)).not.toContain("VERY_SECRET");
  expect(await db.news.count()).toBe(0);
  await db.$disconnect();
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  expect(await getVkTagRecheckStatus(db, group.id)).toMatchObject({ pending: true, appliedRevision: 0 });
  expect(await run(api)).toMatchObject({ successful: true, pending: false, appliedRevision: 1, added: 1 });
  expect(await run(api)).toMatchObject({ successful: true, added: 0, pending: false });
  const news = await db.news.findMany({ include: { images: { orderBy: { sortOrder: "asc" } } } });
  expect(news).toHaveLength(1);
  expect(news[0].images.map((image) => readFileSync(join(directory, image.id), "utf8"))).toEqual(["first", "second"]);
});

it("keeps a newer catalogue generation queued when a tag changes during the current recheck", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  let changedDuringRun = false;
  const api = wall([post(1)]);
  const original = api.getWall;
  api.getWall = async (...args) => {
    if (!changedDuringRun) { changedDuringRun = true; await changed(); }
    return original(...args);
  };
  expect(await run(api)).toMatchObject({ successful: true, revision: 2, appliedRevision: 1, pending: true, added: 1 });
  expect(await getVkTagRecheckStatus(db, group.id)).toMatchObject({ revision: 2, appliedRevision: 1, pending: true });
  expect(await run(api)).toMatchObject({ successful: true, revision: 2, appliedRevision: 2, pending: false, added: 0 });
  expect(await db.news.count()).toBe(1);
});

it("preserves published basis, hidden and deleted decisions and independent edits after catalogue rename and removal", async () => {
  const tag = await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  const api = wall([post(4), post(3), post(2), post(1)]);
  expect(await run(api)).toMatchObject({ added: 4, successful: true });
  const records = await db.news.findMany({ include: { vkImport: true } });
  const newsId = (postId: string) => records.find((news) => news.vkImport?.postId === postId)!.id;
  const editor = { db, files: createNewsPhotoFiles({ directory }), invalidate: () => {} };
  await setNewsVisibility(editor, newsId("2"), true);
  await deleteNewsWithDecisions(editor, newsId("3"));
  await disableVkSync(editor, newsId("4"));
  await db.news.update({ where: { id: newsId("4") }, data: { title: "Редакторский заголовок", text: "Самостоятельный текст" } });
  await db.newsTags.update({ where: { id: tag.id }, data: { title: "Образование", normalizedTitle: "образование" } });
  await changed();
  expect(await run(api)).toMatchObject({ added: 0, successful: true });
  await db.newsTags.delete({ where: { id: tag.id } });
  await changed();
  expect(await run(api)).toMatchObject({ added: 0, successful: true });
  expect(await db.news.findUnique({ where: { id: newsId("1") } })).toMatchObject({ hidden: false, title: "Новость 1" });
  expect(await db.news.findUnique({ where: { id: newsId("2") } })).toMatchObject({ hidden: true });
  expect(await db.news.findUnique({ where: { id: newsId("3") } })).toBeNull();
  expect(await db.news.findUnique({ where: { id: newsId("4") } })).toMatchObject({ title: "Редакторский заголовок", text: "Самостоятельный текст" });
  expect((await db.vkImportPost.findUniqueOrThrow({ where: { groupId_postId: { groupId: group.id, postId: "1" } } })).selectionBasis)
    .toEqual([{ name: "наука", tagId: tag.id }]);
});

it("serializes overlapping rechecks across independent database clients and leaves one publication", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const api = wall([post(1)]);
  const original = api.getWall;
  api.getWall = async (...args) => { entered(); await waiting; return original(...args); };
  const first = run(api);
  await started;
  const otherDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    const second = await recheckVkTags({ db: otherDb, api: wall([post(1)]), images, invalidate: () => {} });
    expect(second).toMatchObject({ successful: false, pending: true, added: 0 });
    expect(second.error).toContain("другой проверки");
  } finally { await otherDb.$disconnect(); release(); }
  expect(await first).toMatchObject({ successful: true, pending: false, added: 1 });
  expect(await db.news.count()).toBe(1);
});

it("persists a completed recheck result so status after restart agrees with the returned progress", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  const result = await run(wall([post(1)]));
  expect(result).toMatchObject({ successful: true, pending: false, revision: 1, appliedRevision: 1 });
  const source = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } });
  expect(source.lastTagRecheckResult).toMatchObject({ successful: true, pending: false, revision: 1, appliedRevision: 1, added: 1 });
});

it("applies the catalogue generation independently to the newly configured canonical source", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, added: 1, appliedRevision: 1 });
  const otherGroup = { ...group, id: "456", screenName: "other.group" };
  expect(await getVkTagRecheckStatus(db, otherGroup.id)).toMatchObject({ pending: true, appliedRevision: 0 });
  expect(await run(wall([post(1, { ownerId: "-456", fromId: "-456" })], otherGroup)))
    .toMatchObject({ successful: true, added: 1, group: otherGroup, appliedRevision: 1, pending: false });
  expect(await getVkTagRecheckStatus(db, group.id)).toMatchObject({ pending: false, appliedRevision: 1 });
  expect((await db.news.findMany({ include: { vkImport: true } })).map((news) => news.vkImport?.groupId).sort()).toEqual(["123", "456"]);
});

it("leaves a incomplete or failed wall recheck queued and preserves the prior publication", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, added: 1 });
  const successAt = (await getVkTagRecheckStatus(db, group.id)).lastSuccessAt;
  await changed();
  const incomplete = wall([post(1, { text: "changed" })]);
  incomplete.getWall = async () => ({ items: [post(1, { text: "changed" })], count: 10 });
  expect(await run(incomplete)).toMatchObject({ successful: false, pending: true, appliedRevision: 1, lastSuccessAt: successAt, added: 0 });
  const failed = wall([]);
  failed.getWall = async () => { throw new Error("token=VERY_SECRET"); };
  const result = await run(failed);
  expect(result).toMatchObject({ successful: false, pending: true, appliedRevision: 1, lastSuccessAt: successAt });
  expect(JSON.stringify(result)).not.toContain("VERY_SECRET");
  expect(await db.news.findFirst()).toMatchObject({ title: "Новость 1", hidden: false });
});

it("does not show another community's recheck error on a source that already applied the catalogue", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, pending: false });
  const other = wall([], { ...group, id: "456", screenName: "other.group" });
  other.getWall = async () => { throw new Error("network unavailable"); };
  expect(await run(other)).toMatchObject({ successful: false, pending: true });
  expect(await getVkTagRecheckStatus(db, group.id)).toMatchObject({ pending: false, error: null });
  expect((await getVkTagRecheckStatus(db, "456")).error).toContain("Не удалось подключиться");
  expect((await getVkTagRecheckStatus(db, "789")).error).toBeNull();
});

it("keeps catalogue changes queued until tag and news caches refresh even when every post is already imported", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  const api = wall([post(1)]);
  expect(await run(api)).toMatchObject({ successful: true, added: 1 });
  await changed();
  const result = await recheckVkTags({ db, api, images, invalidate: () => { throw new Error("cache token=VERY_SECRET"); } });
  expect(result).toMatchObject({ successful: false, pending: true, revision: 2, appliedRevision: 1, added: 0 });
  expect(JSON.stringify(result)).not.toContain("VERY_SECRET");
  expect(await run(api)).toMatchObject({ successful: true, pending: false, appliedRevision: 2, added: 0 });
  expect(await db.news.count()).toBe(1);
});

it("returns the stored success time when the current community has already applied this generation", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  const api = wall([post(1)]);
  const first = await run(api);
  expect(first.lastSuccessAt).not.toBeNull();
  expect(await run(api)).toMatchObject({ successful: true, pending: false, added: 0, lastSuccessAt: first.lastSuccessAt });
});

it("refreshes canonical source metadata after an alias change without resetting applied tags, history or news", async () => {
  await db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  await changed();
  expect(await run(wall([post(1)]))).toMatchObject({ successful: true, added: 1, appliedRevision: 1 });
  const news = await db.news.findFirstOrThrow();
  const history = await db.vkHistoryJob.create({ data: {
    groupId: group.id, from: "2026-09-01", to: "2026-09-02", state: "retry", scanOffset: 100,
    anchorDate: baseDate, anchorPostId: "90",
  } });
  const renamed = { ...group, name: "Новое название факультета", screenName: "biotech.new" };
  const api = wall([], renamed);
  api.getWall = async () => { throw new Error("An applied generation must not rescan the wall"); };
  expect(await run(api)).toMatchObject({ successful: true, group: renamed, appliedRevision: 1, pending: false, added: 0 });
  expect(await db.vkImportSource.findUniqueOrThrow({ where: { groupId: group.id } }))
    .toMatchObject({ groupId: "123", name: "Новое название факультета", screenName: "biotech.new", tagRecheckAppliedRevision: 1 });
  expect(await db.vkImportSource.count()).toBe(1);
  expect(await db.vkHistoryJob.findUniqueOrThrow({ where: { id: history.id } })).toEqual(history);
  expect(await db.news.findFirstOrThrow()).toEqual(news);
});
