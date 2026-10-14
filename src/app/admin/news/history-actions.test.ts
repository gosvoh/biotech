import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";

const mocks = vi.hoisted(() => ({ db: null as unknown as PrismaClient, auth: vi.fn(async () => ({ user: { role: "admin" } } as { user: { role: string } } | null)), revalidateTag: vi.fn() }));
vi.mock("@/prisma", () => ({ get prisma() { return mocks.db; } }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
import { recheckVkNewsTags } from "./import-actions";
import { queueVkNewsHistory, continueVkNewsHistory } from "./history-actions";
import { getVkHistoryPanelState, getVkTagRecheckPanelState } from "@/lib/vk-import/history-state.server";
let directory: string;
const fetchMock = vi.fn<typeof fetch>();
function response(value: unknown) { return new Response(JSON.stringify({ response: value }), { headers: { "content-type": "application/json" } }); }
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-history-action-"));
  writeFileSync(join(directory, "test.db"), ""); copyFileSync("schema.prisma", join(directory, "schema.prisma")); cpSync("migrations", join(directory, "migrations"), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe" });
  mocks.db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => {
  vi.clearAllMocks(); await mocks.db.vkImportTagCatalog.deleteMany(); await mocks.db.vkImportSource.deleteMany(); await mocks.db.news.deleteMany(); await mocks.db.newsTags.deleteMany();
  await mocks.db.newsTags.create({ data: { id: "science", title: "Наука", normalizedTitle: "наука" } });
  mocks.auth.mockResolvedValue({ user: { role: "admin" } });
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); vi.stubEnv("VK_GROUP_ID", "biotech.itmo"); vi.stubEnv("VK_GROUP_TOKEN", "test-only-never-print-token");
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("groups.getById")) return response({ groups: [{ id: 42, name: "Тестовый источник", screen_name: "biotech.itmo" }] });
    if (String(url).endsWith("wall.get")) return response({ count: 1, items: [{ id: 1, owner_id: -42, from_id: -42, date: Date.parse("2026-09-01T00:00:00+03:00") / 1000, text: "Историческая новость #Наука", post_type: "post", attachments: [] }] });
    if (String(url).endsWith("wall.getById")) return response([]);
    throw new Error("test-only-never-print-token");
  }); vi.stubGlobal("fetch", fetchMock);
});
afterAll(async () => { await mocks.db?.$disconnect(); if (directory) { if (!resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-history-action-"))) throw new Error("Unsafe cleanup"); rmSync(directory, { recursive: true, force: true }); } vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([null, { user: { role: "user" } }])("protects both queue and continuation before network or writes", async (session) => {
  mocks.auth.mockResolvedValue(session);
  expect(await queueVkNewsHistory("2026-09-01", "2026-09-01")).toMatchObject({ ok: false });
  expect(await continueVkNewsHistory("unknown")).toMatchObject({ ok: false });
  expect(await recheckVkNewsTags()).toMatchObject({ ok: false });
  expect(fetchMock).not.toHaveBeenCalled(); expect(await mocks.db.vkImportSource.count()).toBe(0);
});
it("queues then continues a real job and exposes saved safe progress after reload", async () => {
  const queued = await queueVkNewsHistory("2026-09-01", "2026-09-01");
  expect(queued).toMatchObject({ ok: true, data: { state: "queued", processed: 0 } });
  if (!queued.ok) throw new Error("Queue failed");
  expect(await mocks.db.news.count()).toBe(0);
  const finished = await continueVkNewsHistory(queued.data.id);
  expect(finished).toMatchObject({ ok: true, data: { added: 1, failed: 0 } });
  const panel = await getVkHistoryPanelState();
  expect(panel.jobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: queued.data.id, added: 1 })]));
  expect(JSON.stringify(panel)).not.toContain("test-only-never-print-token");
  expect(await mocks.db.news.count()).toBe(1);
});

it("returns safe Moscow-date validation before reading VK and leaves no queued job", async () => {
  expect(await queueVkNewsHistory("2026-08-31", "2026-09-01")).toMatchObject({ ok: false, error: expect.stringContaining("1 сентября") });
  expect(await queueVkNewsHistory("2026-09-31", "2026-10-01")).toMatchObject({ ok: false, error: expect.stringContaining("календарную дату") });
  expect(fetchMock).not.toHaveBeenCalled(); expect(await mocks.db.vkImportSource.count()).toBe(0);
});

it("rejects continuing an old source with changed configuration and does not borrow its progress", async () => {
  const queued = await queueVkNewsHistory("2026-09-01", "2026-09-01");
  if (!queued.ok) throw new Error("Queue failed");
  vi.stubEnv("VK_GROUP_ID", "another.group");
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("groups.getById")) return response({ groups: [{ id: 99, name: "Другой источник", screen_name: "another.group" }] });
    throw new Error("History must not read wall or files after source change");
  });
  expect(await continueVkNewsHistory(queued.data.id)).toMatchObject({ ok: false, error: expect.stringContaining("ВК изменился") });
  expect((await getVkHistoryPanelState()).jobs).toEqual([]); expect(await mocks.db.news.count()).toBe(0);
});

it.each(["queue", "tags"])("keeps the current history visible after the same community changes alias through %s", async (operation) => {
  const queued = await queueVkNewsHistory("2026-09-01", "2026-09-01");
  if (!queued.ok) throw new Error("Queue failed");
  vi.stubEnv("VK_GROUP_ID", "renamed.community");
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("groups.getById")) return response({ groups: [{ id: 42, name: "Обновлённое название", screen_name: "renamed.community" }] });
    if (String(url).endsWith("wall.get")) return response({ count: 0, items: [] });
    throw new Error("Unexpected call");
  });
  if (operation === "queue") expect(await queueVkNewsHistory("2026-09-01", "2026-09-01")).toMatchObject({ ok: true, data: { id: queued.data.id } });
  else {
    await mocks.db.vkImportTagCatalog.create({ data: { id: 1, revision: 1 } });
    expect(await recheckVkNewsTags()).toMatchObject({ ok: true, data: { successful: true, appliedRevision: 1 } });
    expect(await getVkTagRecheckPanelState("42")).toMatchObject({ pending: false, appliedRevision: 1 });
  }
  expect((await getVkHistoryPanelState()).jobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: queued.data.id, groupId: "42" })]));
});
