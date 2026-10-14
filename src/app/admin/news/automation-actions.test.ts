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
import { setVkNewsAutomation } from "./automation-actions";
import { getVkAutomationPanelState } from "@/lib/vk-import/automation-state.server";
import { getVkImportStatus } from "@/lib/vk-import/status.server";
let directory: string;
const fetchMock = vi.fn<typeof fetch>();
function response(value: unknown) { return new Response(JSON.stringify({ response: value }), { headers: { "content-type": "application/json" } }); }
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-auto-action-")); writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma")); cpSync("migrations", join(directory, "migrations"), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe" });
  mocks.db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => {
  vi.clearAllMocks(); await mocks.db.vkAutomationRuntime.deleteMany(); await mocks.db.vkImportSource.deleteMany();
  mocks.auth.mockResolvedValue({ user: { role: "admin" } }); vi.stubEnv("DISABLE_ADMIN_AUTH", "false");
  vi.stubEnv("VK_GROUP_ID", "biotech.itmo"); vi.stubEnv("VK_GROUP_TOKEN", "test-secret-not-for-output");
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("groups.getById")) return response({ groups: [{ id: 42, name: "Тестовая группа", screen_name: "biotech.itmo" }] });
    if (String(url).endsWith("wall.get")) return response({ count: 0, items: [] });
    throw new Error("test-secret-not-for-output");
  }); vi.stubGlobal("fetch", fetchMock);
});
afterAll(async () => { await mocks.db?.$disconnect(); if (directory) { if (!resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-auto-action-"))) throw new Error("Unsafe cleanup"); rmSync(directory, { recursive: true, force: true }); } vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([null, { user: { role: "user" } }])("protects enabling and disabling before API access or state changes", async (session) => {
  mocks.auth.mockResolvedValue(session);
  expect(await setVkNewsAutomation(true, "biotech.itmo", null)).toMatchObject({ ok: false });
  expect(await setVkNewsAutomation(false, "biotech.itmo", "42")).toMatchObject({ ok: false });
  expect(fetchMock).not.toHaveBeenCalled(); expect(await mocks.db.vkImportSource.count()).toBe(0);
});
it("keeps an existing source readable and allows OFF without API or a working token", async () => {
  expect(await setVkNewsAutomation(true, "biotech.itmo", null)).toMatchObject({ ok: true, data: { enabled: true } });
  vi.stubEnv("VK_GROUP_TOKEN", ""); fetchMock.mockClear();
  expect(await getVkImportStatus()).toMatchObject({ configured: false, group: { id: "42" }, error: expect.stringContaining("VK_GROUP_TOKEN") });
  expect(await getVkAutomationPanelState()).toMatchObject({ groupId: "42", enabled: true });
  expect(await setVkNewsAutomation(false, "biotech.itmo", "42")).toMatchObject({ ok: true, data: { enabled: false } });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("enables one initial history without reporting a successful import, and resumes that identity", async () => {
  const first = await setVkNewsAutomation(true, "biotech.itmo", null);
  expect(first).toMatchObject({ ok: true, data: { enabled: true, lastNewAt: null, lastSyncAt: null, initialState: { from: "2026-09-01", state: "queued" } } });
  if (!first.ok) throw new Error("Enable failed");
  const second = await setVkNewsAutomation(true, "biotech.itmo", "42");
  expect(second).toMatchObject({ ok: true, data: { initialHistoryId: first.data.initialHistoryId } });
  expect(await mocks.db.vkHistoryJob.count()).toBe(1);
  expect(await getVkAutomationPanelState()).toMatchObject({ groupId: "42", enabled: true, initialHistoryId: first.data.initialHistoryId });
});

it("does not enable or disclose raw errors when VK denies the wall probe", async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith("groups.getById") ? response({ groups: [{ id: 42, name: "Группа", screen_name: "biotech.itmo" }] }) : new Response(JSON.stringify({ error: { error_code: 27, error_msg: "test-secret-not-for-output" } })));
  const denied = await setVkNewsAutomation(true, "biotech.itmo", null);
  expect(denied.ok).toBe(false); expect(JSON.stringify(denied)).not.toContain("test-secret-not-for-output");
  expect(await getVkAutomationPanelState()).toMatchObject({ enabled: false });
  expect(await mocks.db.vkHistoryJob.count()).toBe(0);
});

it("rejects a stale page after environment source changes and does not transfer enabled state", async () => {
  await setVkNewsAutomation(true, "biotech.itmo", null);
  vi.stubEnv("VK_GROUP_ID", "another.group"); fetchMock.mockClear();
  expect(await setVkNewsAutomation(false, "biotech.itmo", "42")).toMatchObject({ ok: false, error: expect.stringContaining("Источник ВК изменился") });
  expect(await getVkAutomationPanelState()).toMatchObject({ groupId: null, enabled: false, running: false, initialHistoryId: null });
  expect(fetchMock).not.toHaveBeenCalled();
});
