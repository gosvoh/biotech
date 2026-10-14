import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { deleteNewsWithDecisions, disableVkSync, duplicateNewsWithPhotos, restoreVkPostExclusion, setNewsVisibility } from "./editor";
import { createNewsPhotoFiles } from "./news-files";

let directory: string;
let photos: string;
let db: PrismaClient;
let invalidations = 0;
const legacyPhoto = "cmg1234567890123456789012";
const options = () => ({ db, files: createNewsPhotoFiles({ directory: photos }), invalidate: () => { invalidations++; } });

async function createNews(imported = true, autoHiddenReason: string | null = null) {
  const news = await db.news.create({
    data: {
      title: "Исходный заголовок", text: "Полный текст #Наука", date: "2026-09-02",
      links: '{"vkLink":"https://vk.ru/wall-123_1"}', hidden: autoHiddenReason !== null,
      tags: { connect: { id: "science" } },
    },
  });
  if (imported) {
    await db.vkImportSource.upsert({
      where: { groupId: "123" }, update: {},
      create: { groupId: "123", name: "Биотехнологии", screenName: "biotech" },
    });
    await db.vkImportPost.create({
      data: { groupId: "123", postId: "1", newsId: news.id, status: "imported", autoHiddenReason },
    });
  }
  return news;
}
async function addPhotos(newsId: string) {
  for (const [id, sortOrder, bytes] of [
    [legacyPhoto, 3, "first"],
    ["vk-22222222-2222-4222-8222-222222222222", 8, "second"],
  ] as const) {
    await db.newsImages.create({ data: { id, newsId, sortOrder } });
    writeFileSync(join(photos, `${id}.webp`), bytes);
  }
}
const metadata = () => db.vkImportPost.findUniqueOrThrow({ where: { groupId_postId: { groupId: "123", postId: "1" } } });

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-editor-"));
  photos = join(directory, "photos");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(photos);
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
  for (const name of readdirSync(photos)) rmSync(join(photos, name));
  invalidations = 0;
});
afterAll(async () => {
  await db?.$disconnect();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-editor-"))) rmSync(directory, { recursive: true, force: true });
});

it("persists explicit manual hiding and increments the decision revision", async () => {
  const news = await createNews();
  expect(await setNewsVisibility(options(), news.id, true)).toMatchObject({ hidden: true });
  expect(await metadata()).toMatchObject({ manualHidden: true, revision: 1 });
  expect(await setNewsVisibility(options(), news.id, false)).toMatchObject({ hidden: false });
  expect(await metadata()).toMatchObject({ manualHidden: false, revision: 2 });
  expect(invalidations).toBe(2);
});
it("keeps a confirmed source issue hidden when the editor removes manual hiding", async () => {
  const news = await createNews(true, "source-deleted");
  await setNewsVisibility(options(), news.id, true);
  expect(await setNewsVisibility(options(), news.id, false)).toMatchObject({ hidden: true });
  expect(await metadata()).toMatchObject({ manualHidden: false, autoHiddenReason: "source-deleted", revision: 2 });
});
it("keeps manual news visibility independent from the VK ledger", async () => {
  const news = await createNews(false);
  expect(await setNewsVisibility(options(), news.id, true)).toMatchObject({ hidden: true });
  expect(await db.vkImportPost.count()).toBe(0);
  expect(invalidations).toBe(1);
});
it("records deletion before removing the news and removes every owned photo after commit", async () => {
  const news = await createNews();
  await setNewsVisibility(options(), news.id, true);
  await addPhotos(news.id);
  const base = options();
  const remove = base.files.remove;
  base.files.remove = async images => {
    expect(await db.news.findUnique({ where: { id: news.id } })).toBeNull();
    expect(await metadata()).toMatchObject({ newsId: null, manualDeleted: true, manualHidden: true, revision: 2 });
    await remove(images);
  };
  await deleteNewsWithDecisions(base, news.id);
  expect(await db.newsImages.count()).toBe(0);
  expect(readdirSync(photos)).toEqual([]);
  expect(await metadata()).toMatchObject({ manualDeleted: true, status: "imported" });
});
it("removes ordinary manual news and legacy photos without creating VK metadata", async () => {
  const news = await createNews(false);
  await addPhotos(news.id);
  await deleteNewsWithDecisions(options(), news.id);
  expect(await db.news.count()).toBe(0);
  expect(await db.vkImportPost.count()).toBe(0);
  expect(readdirSync(photos)).toEqual([]);
});
it("restores only the exclusion and queues missing news without publishing or removing manual hiding", async () => {
  const news = await createNews();
  await setNewsVisibility(options(), news.id, true);
  await deleteNewsWithDecisions(options(), news.id);
  await restoreVkPostExclusion(options(), "123", "1");
  expect(await metadata()).toMatchObject({ newsId: null, manualDeleted: false, manualHidden: true, status: "pending", revision: 3 });
  expect(await db.news.count()).toBe(0);
});
it("disables sync without changing content or automatic hidden state", async () => {
  const news = await createNews(true, "source-deleted");
  expect(await disableVkSync(options(), news.id)).toMatchObject({ title: news.title, text: news.text, hidden: true });
  expect(await metadata()).toMatchObject({ syncEnabled: false, revision: 1, autoHiddenReason: "source-deleted" });
});
it("copies all ordered photos into an independent hidden draft with fresh identities", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  const duplicate = await duplicateNewsWithPhotos(options(), news.id);
  expect(duplicate).toMatchObject({ title: news.title, text: news.text, date: news.date, links: news.links, hidden: true });
  expect(duplicate.id).not.toBe(news.id);
  const draft = await db.news.findUniqueOrThrow({ where: { id: duplicate.id }, include: { vkImport: true, tags: true, images: { orderBy: { sortOrder: "asc" } } } });
  expect(draft.vkImport).toBeNull();
  expect(draft.tags.map(item => item.id)).toEqual(["science"]);
  expect(draft.images.map(item => item.sortOrder)).toEqual([3, 8]);
  expect(draft.images.every(item => item.id.startsWith("vk-") && item.id !== legacyPhoto)).toBe(true);
  expect(draft.images.map(item => readFileSync(join(photos, `${item.id}.webp`), "utf8"))).toEqual(["first", "second"]);
  await deleteNewsWithDecisions(options(), news.id);
  expect(draft.images.map(item => readFileSync(join(photos, `${item.id}.webp`), "utf8"))).toEqual(["first", "second"]);
});
it("rolls back only new copies and publishes no draft when copying a later photo fails", async () => {
  const news = await createNews();
  await db.newsImages.createMany({ data: [
    { id: legacyPhoto, newsId: news.id, sortOrder: 0 },
    { id: "cmg9999999999999999999999", newsId: news.id, sortOrder: 1 },
  ] });
  writeFileSync(join(photos, `${legacyPhoto}.webp`), "original");
  await expect(duplicateNewsWithPhotos(options(), news.id)).rejects.toThrow(/фотограф/);
  expect(await db.news.count()).toBe(1);
  expect(readdirSync(photos)).toEqual([`${legacyPhoto}.webp`]);
  expect(readFileSync(join(photos, `${legacyPhoto}.webp`), "utf8")).toBe("original");
});
it("rejects a source decision changed during copying and discards the new files", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  const base = options();
  const clone = base.files.clone;
  base.files.clone = async images => {
    const copied = await clone(images);
    await disableVkSync(options(), news.id);
    return copied;
  };
  await expect(duplicateNewsWithPhotos(base, news.id)).rejects.toThrow(/изменилась/);
  expect(await db.news.count()).toBe(1);
  expect(readdirSync(photos).sort()).toEqual([`${legacyPhoto}.webp`, "vk-22222222-2222-4222-8222-222222222222.webp"].sort());
});
it("retains committed decisions and durable invalidation after a cache failure", async () => {
  const news = await createNews();
  await expect(setNewsVisibility({ ...options(), invalidate: () => { throw new Error("cache-secret"); } }, news.id, true)).rejects.toThrow(/сохранен|сохранён/);
  expect(await db.news.findUnique({ where: { id: news.id } })).toMatchObject({ hidden: true });
  expect(await metadata()).toMatchObject({ manualHidden: true, revision: 1 });
  expect(await db.vkImportSource.findUnique({ where: { groupId: "123" } })).toMatchObject({ needsRevalidate: true });
});
it("keeps committed draft files when invalidating its cache fails", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  await expect(duplicateNewsWithPhotos({ ...options(), invalidate: () => { throw new Error("cache-secret"); } }, news.id)).rejects.toThrow(/сохранен|сохранён/);
  const draft = await db.news.findFirstOrThrow({ where: { id: { not: news.id } }, include: { images: true } });
  expect(draft.hidden).toBe(true);
  expect(draft.images).toHaveLength(2);
  expect(draft.images.every(item => existsSync(join(photos, `${item.id}.webp`)))).toBe(true);
});
it("returns controlled errors for unknown news and unknown exclusion", async () => {
  await expect(setNewsVisibility(options(), "unknown", true)).rejects.toThrow(/не найдена/);
  await expect(deleteNewsWithDecisions(options(), "unknown")).rejects.toThrow(/не найдена/);
  await expect(duplicateNewsWithPhotos(options(), "unknown")).rejects.toThrow(/не найдена/);
  await expect(disableVkSync(options(), "unknown")).rejects.toThrow(/не найдена/);
  await expect(restoreVkPostExclusion(options(), "123", "unknown")).rejects.toThrow(/не найден/);
});




it("lets an editor explicitly publish after disabling sync and clears the stale automatic reason", async () => {
  const news = await createNews(true, "source-deleted");
  await disableVkSync(options(), news.id);
  expect(await setNewsVisibility(options(), news.id, false)).toMatchObject({ hidden: false });
  expect(await metadata()).toMatchObject({ syncEnabled: false, manualHidden: false, autoHiddenReason: null, revision: 2 });
});
it("rolls back the deletion decision and retains original files when the database rejects deletion", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  await db.$executeRawUnsafe("CREATE TRIGGER editor_block_delete BEFORE DELETE ON News BEGIN SELECT RAISE(ABORT, 'test-delete-failure'); END");
  try {
    await expect(deleteNewsWithDecisions(options(), news.id)).rejects.toThrow(/сохранить/);
    expect(await metadata()).toMatchObject({ manualDeleted: false, newsId: news.id, revision: 0 });
    expect(await db.news.count()).toBe(1);
    expect(readdirSync(photos)).toHaveLength(2);
    expect(invalidations).toBe(0);
  } finally {
    await db.$executeRawUnsafe("DROP TRIGGER editor_block_delete");
  }
});
it("retains the exclusion and removes files after a committed deletion even when cache invalidation fails", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  await expect(deleteNewsWithDecisions({ ...options(), invalidate: () => { throw new Error("cache-secret"); } }, news.id)).rejects.toThrow(/сохранен|сохранён/);
  expect(await metadata()).toMatchObject({ manualDeleted: true, newsId: null, revision: 1 });
  expect(await db.news.count()).toBe(0);
  expect(readdirSync(photos)).toEqual([]);
  expect(await db.vkImportSource.findUnique({ where: { groupId: "123" } })).toMatchObject({ needsRevalidate: true });
});
it("rejects changed source text during copying without creating a mismatched draft", async () => {
  const news = await createNews();
  await addPhotos(news.id);
  const base = options();
  const clone = base.files.clone;
  base.files.clone = async images => {
    const copied = await clone(images);
    await db.news.update({ where: { id: news.id }, data: { text: "Редактор изменил содержимое" } });
    return copied;
  };
  await expect(duplicateNewsWithPhotos(base, news.id)).rejects.toThrow(/изменилась/);
  expect(await db.news.count()).toBe(1);
  expect(readdirSync(photos)).toHaveLength(2);
});

it("advances the durable cache generation for two committed decisions whose invalidations fail", async () => {
  const news = await createNews();
  const failing = { ...options(), invalidate: () => { throw new Error("cache-secret"); } };
  await expect(setNewsVisibility(failing, news.id, true)).rejects.toThrow(/сохранен|сохранён/);
  expect(await db.vkImportSource.findUnique({ where: { groupId: "123" } })).toMatchObject({ needsRevalidate: true, revalidationRevision: 1 });
  await expect(setNewsVisibility(failing, news.id, false)).rejects.toThrow(/сохранен|сохранён/);
  expect(await db.vkImportSource.findUnique({ where: { groupId: "123" } })).toMatchObject({ needsRevalidate: true, revalidationRevision: 2 });
  expect(await metadata()).toMatchObject({ manualHidden: false, revision: 2 });
  expect(await db.news.findUnique({ where: { id: news.id } })).toMatchObject({ hidden: false });
});
it.each(["hide", "delete", "restore", "disable", "duplicate"] as const)(
  "keeps a durable generation for linked editor operation %s and clears obsolete deletion work where appropriate",
  async operation => {
    const news = await createNews();
    await db.vkImportPost.update({
      where: { groupId_postId: { groupId: "123", postId: "1" } },
      data: { deletionRetry: true, deletionRetryAt: new Date("2026-10-14T00:00:00Z") },
    });
    if (operation === "restore") {
      await db.vkImportPost.update({
        where: { groupId_postId: { groupId: "123", postId: "1" } },
        data: { manualDeleted: true },
      });
      await db.news.delete({ where: { id: news.id } });
    }
    switch (operation) {
      case "hide": await setNewsVisibility(options(), news.id, true); break;
      case "delete": await deleteNewsWithDecisions(options(), news.id); break;
      case "restore": await restoreVkPostExclusion(options(), "123", "1"); break;
      case "disable": await disableVkSync(options(), news.id); break;
      case "duplicate": await duplicateNewsWithPhotos(options(), news.id); break;
    }
    expect(await db.vkImportSource.findUnique({ where: { groupId: "123" } })).toMatchObject({ needsRevalidate: true, revalidationRevision: 1 });
    if (["delete", "restore", "disable"].includes(operation)) {
      expect(await metadata()).toMatchObject({ deletionRetry: false, deletionRetryAt: null, revision: 1 });
    } else {
      expect(await metadata()).toMatchObject({ deletionRetry: true });
    }
  },
);
