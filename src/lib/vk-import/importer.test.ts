import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { importVkNews } from "./importer";
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
          const id = `photo-${Date.now()}-${call}-${index}`;
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
const run = (api: VkApi, store = images(), invalidate: () => void | Promise<void> = () => {}) => importVkNews({ db, api, images: store, invalidate });

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-import-"));
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
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-import-"))) rmSync(directory, { recursive: true, force: true });
});

it("publishes complete text, tags, original date and every photo in order", async () => {
  const item = post(1, { photos: [{ url: "first" }, { url: "second" }] });
  expect(await run(wall([item]))).toMatchObject({ successful: true, added: 1, failed: 0 });
  const news = await db.news.findFirstOrThrow({ include: { images: { orderBy: { sortOrder: "asc" } }, tags: true, vkImport: true } });
  expect(news).toMatchObject({ title: "Новость 1", date: "2026-09-02", hidden: false, tags: [{ id: "science" }], vkImport: { groupId: "123", postId: "1", status: "imported" } });
  expect(news.text).toContain("#Наука");
  expect(JSON.parse(news.links)).toEqual({ vkLink: "https://vk.ru/wall-123_1" });
  expect(news.images.map((image) => image.sortOrder)).toEqual([0, 1]);
  expect(news.images.every((image) => existsSync(join(directory, image.id)))).toBe(true);
});
it("bootstraps the latest thirty by date despite an old pinned item", async () => {
  const posts = [post(1, { isPinned: true }), ...Array.from({ length: 50 }, (_, index) => post(100 - index))];
  expect(await run(wall(posts))).toMatchObject({ added: 30, successful: true });
  expect((await db.vkImportPost.findMany()).map((item) => item.postId).sort()).toEqual(posts.slice(1, 31).map((item) => item.id).sort());
});
it("catches up more than a page and includes lower-id posts in the cursor boundary second", async () => {
  await run(wall([post(1000, { date: baseDate })]));
  const posts = Array.from({ length: 140 }, (_, index) => post(500 - index));
  posts.push(post(2, { date: baseDate }));
  posts.unshift(post(1, { isPinned: true, date: baseDate - 100 }));
  expect(await run(wall(posts))).toMatchObject({ added: 141, successful: true });
  expect(await db.news.count()).toBe(142);
});
it("does not publish partial photos and retries a durable failure outside the wall window", async () => {
  const failed = post(5, { photos: [{ url: "a" }, { url: "b" }] });
  const first = await run(wall([failed]), images(1));
  expect(first).toMatchObject({ successful: false, failed: 1, added: 0, lastSuccessAt: null });
  expect(JSON.stringify(first)).not.toContain("VERY_SECRET");
  expect(await db.news.count()).toBe(0);
  expect(await db.vkImportPost.findFirst()).toMatchObject({ status: "failed", attempts: 1 });
  const newer = Array.from({ length: 130 }, (_, index) => post(200 - index));
  const api = wall(newer);
  api.getPosts = async () => [failed];
  expect(await run(api)).toMatchObject({ successful: true, added: 131, failed: 0 });
  expect(await db.vkImportPost.findUnique({ where: { groupId_postId: { groupId: "123", postId: "5" } } })).toMatchObject({ status: "imported", attempts: 2 });
});
it("keeps imported records after news deletion and keeps progress separate for another group", async () => {
  await run(wall([post(1)]));
  await db.news.deleteMany();
  expect(await run(wall([post(1)]))).toMatchObject({ added: 0 });
  expect(await db.news.count()).toBe(0);
  expect(await run(wall([post(1, { ownerId: "-456", fromId: "-456" })], { ...group, id: "456" }))).toMatchObject({ added: 1 });
  expect(await db.vkImportSource.count()).toBe(2);
});
it("rejects an overlapping run with a database lease", async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const api = wall([post(1)]);
  const normal = api.getWall;
  api.getWall = async (...args) => { entered(); await waiting; return normal(...args); };
  const first = run(api);
  await started;
  const independentDb = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  const second = await importVkNews({ db: independentDb, api: wall([post(1)]), images: images(), invalidate: () => {} });
  await independentDb.$disconnect();
  expect(second).toMatchObject({ successful: false, added: 0 });
  expect(second.error).toContain("выполняется");
  release();
  expect(await first).toMatchObject({ successful: true, added: 1 });
  expect(await db.news.count()).toBe(1);
});
it("retains committed files and retries cache invalidation after a cache error", async () => {
  const first = await run(wall([post(1, { photos: [{ url: "photo" }] })]), images(), () => { throw new Error("cache-secret"); });
  expect(first).toMatchObject({ successful: false, added: 1 });
  const photo = await db.newsImages.findFirstOrThrow();
  expect(existsSync(join(directory, photo.id))).toBe(true);
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: true, lastSuccessAt: null });
  expect(await run(wall([]))).toMatchObject({ successful: true, added: 0 });
  expect(await db.vkImportSource.findFirst()).toMatchObject({ needsRevalidate: false });
});
it("does not advance successful time or mutate publication after an API error", async () => {
  await run(wall([post(1)]));
  const source = await db.vkImportSource.findFirstOrThrow();
  const api = wall([]);
  api.getWall = async () => { throw new Error("access_token=VERY_SECRET"); };
  const result = await run(api);
  expect(result).toMatchObject({ successful: false, added: 0, lastSuccessAt: source.lastSuccessAt!.toISOString() });
  expect(JSON.stringify(result)).not.toContain("VERY_SECRET");
  expect(await db.news.count()).toBe(1);
  expect((await db.vkImportSource.findFirstOrThrow()).cursorDate).toBe(source.cursorDate);
});
it("excludes reposts, visitor posts and posts before the Moscow cutoff, preserving skip reasons", async () => {
  const cutoff = Date.parse("2026-09-01T00:00:00+03:00") / 1000;
  const output = await run(wall([
    post(1, { date: cutoff }), post(2, { date: cutoff - 1 }),
    post(3, { isRepost: true }), post(4, { fromId: "99" }), post(5, { text: "#Наука" }),
  ]));
  expect(output).toMatchObject({ successful: true, added: 1, skipped: 4 });
  expect(output.reasons).toHaveLength(4);
  expect(await db.vkImportPost.count()).toBe(5);
});
it("fences an expired owner, discards its prepared files and lets the new owner finish the pending post", async () => {
  let currentTime = new Date("2026-10-13T12:00:00Z");
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const store = images();
  const prepare = store.prepare;
  let staleFiles: PreparedVkImage[] = [];
  store.prepare = async (photos) => { staleFiles = await prepare(photos); entered(); await waiting; return staleFiles; };
  const api = wall([post(1, { photos: [{ url: "photo" }] })]);
  const first = importVkNews({ db, api, images: store, invalidate: () => {}, now: () => currentTime });
  await started;
  currentTime = new Date(currentTime.getTime() + 6 * 60 * 1000);
  expect(await importVkNews({ db, api, images: images(), invalidate: () => {}, now: () => currentTime })).toMatchObject({ successful: true, added: 1 });
  release();
  expect(await first).toMatchObject({ successful: false, added: 0 });
  expect(staleFiles.every((item) => !existsSync(join(directory, item.id)))).toBe(true);
  expect(await db.news.count()).toBe(1);
  expect(await db.vkImportSource.findFirst()).toMatchObject({ lastError: null, leaseToken: null });
});
it("retries a crashed pending record by identity outside the latest wall window", async () => {
  await run(wall([post(100)]));
  await db.vkImportPost.create({ data: { groupId: group.id, postId: "2", status: "pending", attempts: 1 } });
  const api = wall([post(101)]);
  api.getPosts = async (_, ids) => ids.includes("2") ? [post(2)] : [];
  expect(await run(api)).toMatchObject({ successful: true, added: 2 });
  expect(await db.vkImportPost.findUnique({ where: { groupId_postId: { groupId: group.id, postId: "2" } } })).toMatchObject({ attempts: 2, status: "imported" });
});
it("discards only this attempt's files when publication transaction cannot connect its tag", async () => {
  const store = images();
  const prepare = store.prepare;
  let attempted: PreparedVkImage[] = [];
  store.prepare = async (...args) => { attempted = await prepare(...args); await db.newsTags.deleteMany(); return attempted; };
  expect(await run(wall([post(1, { photos: [{ url: "photo" }] })]), store)).toMatchObject({ successful: false, failed: 1, added: 0 });
  expect(await db.news.count()).toBe(0);
  expect(await db.newsImages.count()).toBe(0);
  expect(attempted.every((item) => !existsSync(join(directory, item.id)))).toBe(true);
  expect(await db.vkImportPost.findFirst()).toMatchObject({ status: "failed" });
});
it("creates one news on repeated imports and preserves a manual edit of the existing row", async () => {
  await run(wall([post(1)]));
  const created = await db.news.findFirstOrThrow();
  await db.news.update({ where: { id: created.id }, data: { title: "Редакторский заголовок", hidden: true } });
  expect(await run(wall([post(1, { text: "Изменено в ВК #Наука" })]))).toMatchObject({ successful: true, added: 0 });
  expect(await db.news.count()).toBe(1);
  expect(await db.news.findFirst()).toMatchObject({ title: "Редакторский заголовок", hidden: true });
});

it.each([0, 40])("keeps the old cursor and publishes no partial scan for an incomplete intermediate page (%i items)", async (received) => {
  await run(wall([post(1)]));
  const previous = await db.vkImportSource.findFirstOrThrow();
  const posts = Array.from({ length: 150 }, (_, index) => post(1000 - index));
  const api = wall(posts);
  const complete = api.getWall;
  api.getWall = async (...args) => args[1] === 100
    ? { count: posts.length, items: posts.slice(100, 100 + received) }
    : complete(...args);
  expect(await run(api)).toMatchObject({ successful: false, added: 0 });
  expect(await db.news.count()).toBe(1);
  expect(await db.vkImportSource.findFirst()).toMatchObject({ cursorDate: previous.cursorDate, lastSuccessAt: previous.lastSuccessAt });
  expect(await run(wall(posts))).toMatchObject({ successful: true, added: 150 });
  expect(await db.news.count()).toBe(151);
});
