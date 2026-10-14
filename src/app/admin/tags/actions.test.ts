import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PrismaClient,
  auth: vi.fn<() => Promise<{ user: { role: string } } | null>>(async () => ({ user: { role: "admin" } })),
  revalidateTag: vi.fn(),
}));
vi.mock("@/prisma", () => ({ get prisma() { return mocks.db; } }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
import { addNewsTags, deleteNewsTags, updateNewsTags } from "./actions";
import { getVkTagRecheckStatus } from "@/lib/vk-import/recheck";

const migration = "20261013220000_news_tag_normalized_title";
let directory: string;
let preserved: { titles: string[]; relatedTitles: string[]; foreignKeys: unknown[] };

function deploy() {
  execFileSync(process.execPath, [
    resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma"),
  ], {
    env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` },
    stdio: "pipe",
  });
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-news-tags-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) {
    if (entry !== migration) cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  }
  deploy();
  mocks.db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  await mocks.db.$executeRawUnsafe(`INSERT INTO "NewsTags" (id, title) VALUES ('legacy-a', 'Наука'), ('legacy-b', 'наука'), ('legacy-c', 'Научные исследования')`);
  await mocks.db.$executeRawUnsafe(`INSERT INTO "News" (id, title, text, links, date) VALUES ('legacy-news', 'Новость', 'Текст', '', '2026-09-02')`);
  await mocks.db.$executeRawUnsafe(`INSERT INTO "_NewsToNewsTags" ("A", "B") VALUES ('legacy-news', 'legacy-a'), ('legacy-news', 'legacy-c')`);
  if (existsSync(join("migrations", migration))) {
    cpSync(join("migrations", migration), join(directory, "migrations", migration), { recursive: true });
    deploy();
  }
  preserved = {
    titles: (await mocks.db.newsTags.findMany({ orderBy: { id: "asc" } })).map((tag) => tag.title),
    relatedTitles: (await mocks.db.news.findUniqueOrThrow({ where: { id: "legacy-news" }, include: { tags: { orderBy: { id: "asc" } } } })).tags.map((tag) => tag.title),
    foreignKeys: await mocks.db.$queryRawUnsafe("PRAGMA foreign_key_check"),
  };
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false");
  vi.stubEnv("VK_GROUP_ID", "");
  vi.stubEnv("VK_GROUP_TOKEN", "");
}, 30000);

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { role: "admin" } });
  await mocks.db.vkImportPost.deleteMany();
  await mocks.db.vkImportSource.deleteMany();
  await mocks.db.vkImportTagCatalog.deleteMany();
  await mocks.db.news.deleteMany();
  await mocks.db.newsTags.deleteMany();
});

afterAll(async () => {
  await mocks.db?.$disconnect();
  if (directory) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), "biotech-news-tags-"))) throw new Error("Unexpected temporary directory");
    rmSync(directory, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
});

describe("news tag administration", () => {
  it("removes the initial hash and preserves spelling", async () => {
    const result = await addNewsTags("#Наука_2026");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.title).toBe("Наука_2026");
  });
  it.each(["", "#", "Научные исследования", "Наука-наука", "##Наука", "а".repeat(31), "наука\n", "наука\t", "研究"])("rejects invalid title %j through the server action", async (title) => {
    const result = await addNewsTags(title);
    expect(result.ok).toBe(false);
    expect(await mocks.db.newsTags.count()).toBe(0);
  });
  it("rejects an invalid rename without losing the original title", async () => {
    const created = await addNewsTags("Образование");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = await updateNewsTags({ ...created.data, title: "Научные исследования" });
    expect(updated.ok).toBe(false);
    expect((await mocks.db.newsTags.findUniqueOrThrow({ where: { id: created.data.id } })).title).toBe("Образование");
  });
  it("rejects case-insensitive duplicates including Cyrillic Ё", async () => {
    expect((await addNewsTags("Учёба_2026")).ok).toBe(true);
    const duplicate = await addNewsTags("#УЧЁБА_2026");
    expect(duplicate).toEqual({ ok: false, error: "Тег с таким названием уже существует" });
    expect(await mocks.db.newsTags.count()).toBe(1);
  });
  it("rejects a duplicate of an existing legacy tag", async () => {
    await mocks.db.newsTags.create({ data: { title: "Образование" } });
    expect(await addNewsTags("образование")).toEqual({ ok: false, error: "Тег с таким названием уже существует" });
  });
  it("rejects conflicting renames and permits the unchanged own title", async () => {
    const first = await addNewsTags("Наука");
    const second = await addNewsTags("Образование");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect((await updateNewsTags(first.data)).ok).toBe(true);
    expect(await updateNewsTags({ ...second.data, title: "НАУКА" })).toEqual({ ok: false, error: "Тег с таким названием уже существует" });
    expect((await mocks.db.newsTags.findUniqueOrThrow({ where: { id: second.data.id } })).title).toBe("Образование");
  });
  it("allows only one of simultaneous case-insensitive creates", async () => {
    const results = await Promise.all([addNewsTags("Наука"), addNewsTags("НАУКА")]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, error: "Тег с таким названием уже существует" });
    expect(await mocks.db.newsTags.count()).toBe(1);
  });
  it("preserves legacy names, duplicate rows and news relations during migration", () => {
    expect(preserved).toEqual({
      titles: ["Наука", "наука", "Научные исследования"],
      relatedTitles: ["Наука", "Научные исследования"],
      foreignKeys: [],
    });
  });
  it.each(["Science_2026", "Учёба", "123", "а".repeat(30)])("accepts a permitted title %j", async (title) => {
    const result = await addNewsTags(title);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.title).toBe(title);
  });
  it("allows only one of competing renames", async () => {
    const first = await addNewsTags("Наука");
    const second = await addNewsTags("Образование");
    if (!first.ok || !second.ok) throw new Error("Fixture creation failed");
    const results = await Promise.all([
      updateNewsTags({ ...first.data, title: "Медицина" }),
      updateNewsTags({ ...second.data, title: "МЕДИЦИНА" }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, error: "Тег с таким названием уже существует" });
    expect(await mocks.db.newsTags.count()).toBe(2);
  });
  it("keeps news relations while correcting a legacy name", async () => {
    const old = await mocks.db.newsTags.create({ data: { title: "Научные исследования" } });
    await mocks.db.news.create({ data: { title: "Новость", text: "Текст", date: "2026-09-02", links: "", tags: { connect: { id: old.id } } } });
    expect((await updateNewsTags({ ...old, title: "#НаучныеИсследования" })).ok).toBe(true);
    const news = await mocks.db.news.findFirstOrThrow({ include: { tags: true } });
    expect(news.tags.map((tag) => ({ id: tag.id, title: tag.title }))).toEqual([{ id: old.id, title: "НаучныеИсследования" }]);
  });
  it.each(["user", null])("rejects all mutations for a non-admin session %j", async (role) => {
    const old = await mocks.db.newsTags.create({ data: { title: "Наука" } });
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    const results = await Promise.all([addNewsTags("Образование"), updateNewsTags({ ...old, title: "Медицина" }), deleteNewsTags(old.id)]);
    expect(results).toEqual([{ ok: false, error: "Unauthorized" }, { ok: false, error: "Unauthorized" }, { ok: false, error: "Unauthorized" }]);
    expect((await mocks.db.newsTags.findMany()).map((tag) => tag.title)).toEqual(["Наука"]);
  });
  it("removes a deleted name reservation so the name can be reused", async () => {
    const old = await addNewsTags("Учёба");
    if (!old.ok) throw new Error("Fixture creation failed");
    expect((await deleteNewsTags(old.data.id)).ok).toBe(true);
    expect((await addNewsTags("УЧЁБА")).ok).toBe(true);
  });
  it("returns the updated tag after a successful rename", async () => {
    const created = await addNewsTags("Наука");
    if (!created.ok) throw new Error("Fixture creation failed");
    const result = await updateNewsTags({ ...created.data, title: "#Учёба" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ id: created.data.id, title: "Учёба" });
  });
});

it("saves an added tag and durable recheck request while VK is not configured", async () => {
  const saved = await addNewsTags("Образование");
  expect(saved.ok).toBe(true);
  expect(await getVkTagRecheckStatus(mocks.db)).toMatchObject({ revision: 1, appliedRevision: 0, pending: true });
});

it("queues a real rename but leaves the queue unchanged for invalid, unchanged and deleted tags", async () => {
  const added = await addNewsTags("Наука");
  if (!added.ok) throw new Error("Fixture creation failed");
  expect(await getVkTagRecheckStatus(mocks.db)).toMatchObject({ revision: 1 });
  expect((await updateNewsTags(added.data)).ok).toBe(true);
  expect((await updateNewsTags({ ...added.data, title: "Не подходит" })).ok).toBe(false);
  expect(await getVkTagRecheckStatus(mocks.db)).toMatchObject({ revision: 1 });
  expect((await updateNewsTags({ ...added.data, title: "Образование" })).ok).toBe(true);
  expect(await getVkTagRecheckStatus(mocks.db)).toMatchObject({ revision: 2 });
  expect((await deleteNewsTags(added.data.id)).ok).toBe(true);
  expect(await getVkTagRecheckStatus(mocks.db)).toMatchObject({ revision: 2 });
});

it("returns a saved tag after VK failure and retains a safe recheck error for retry", async () => {
  vi.stubEnv("VK_GROUP_ID", "123");
  vi.stubEnv("VK_GROUP_TOKEN", "VERY_SECRET");
  vi.stubGlobal("fetch", async () => { throw new Error("network token=VERY_SECRET"); });
  try {
    const saved = await addNewsTags("Образование");
    expect(saved.ok).toBe(true);
    const queued = await getVkTagRecheckStatus(mocks.db);
    expect(queued).toMatchObject({ revision: 1, pending: true });
    expect(queued.error).toContain("Не удалось подключиться");
    expect(JSON.stringify([saved, queued])).not.toContain("VERY_SECRET");
  } finally {
    vi.stubEnv("VK_GROUP_ID", "");
    vi.stubEnv("VK_GROUP_TOKEN", "");
    vi.unstubAllGlobals();
  }
});

it("runs the queued latest-window recheck immediately after a configured tag is saved", async () => {
  vi.stubEnv("VK_GROUP_ID", "123");
  vi.stubEnv("VK_GROUP_TOKEN", "VERY_SECRET");
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("groups.getById")) return Response.json({ response: { groups: [{ id: 123, name: "Биотехнологии", screen_name: "biotech.itmo" }] } });
    if (url.endsWith("wall.get")) return Response.json({ response: { count: 1, items: [{ id: 1, owner_id: -123, from_id: -123, date: 1788339600, text: "Новость\nТекст #Наука", post_type: "post", attachments: [] }] } });
    throw new Error("Unexpected VK API request");
  });
  try {
    const saved = await addNewsTags("Наука");
    expect(saved.ok).toBe(true);
    expect(await getVkTagRecheckStatus(mocks.db, "123")).toMatchObject({ revision: 1, appliedRevision: 1, pending: false, error: null });
    expect(await mocks.db.news.findFirst({ include: { tags: true } })).toMatchObject({ title: "Новость", hidden: false, tags: [{ title: "Наука" }] });
    expect(mocks.revalidateTag.mock.calls.map(([tag]) => tag)).toContain("newsTags");
    expect(mocks.revalidateTag.mock.calls.map(([tag]) => tag)).toContain("news");
  } finally {
    vi.stubEnv("VK_GROUP_ID", "");
    vi.stubEnv("VK_GROUP_TOKEN", "");
    vi.unstubAllGlobals();
  }
});
