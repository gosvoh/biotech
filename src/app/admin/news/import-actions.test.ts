import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PrismaClient,
  auth: vi.fn(async () => ({ user: { role: "admin" } } as { user: { role: string } } | null)),
  revalidateTag: vi.fn(),
}));
vi.mock("@/prisma", () => ({ get prisma() { return mocks.db; } }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
import { checkVkNews } from "./import-actions";
import { getVkImportStatus } from "@/lib/vk-import/status.server";
import { getNews } from "@/app/news/actions";

let directory: string;
const fetchMock = vi.fn<typeof fetch>();
function response(payload: unknown) { return new Response(JSON.stringify({ response: payload }), { headers: { "content-type": "application/json" } }); }
function setupWall() {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("groups.getById")) return response({ groups: [{ id: 42, name: "Биотех ИТМО", screen_name: "biotech.itmo" }] });
    if (String(url).endsWith("wall.get")) return response({ count: 3, items: [
      { id: 3, owner_id: -42, from_id: -42, date: Date.parse("2026-10-13T19:00:00Z") / 1000, text: "Новая новость #Наука", post_type: "post", attachments: [] },
      { id: 2, owner_id: -42, from_id: -42, date: Date.parse("2026-10-12T19:00:00Z") / 1000, text: "Репост #Наука", post_type: "post", copy_history: [{}], attachments: [] },
      { id: 1, owner_id: -42, from_id: -42, date: Date.parse("2026-08-31T20:59:59Z") / 1000, text: "Старая новость #Наука", post_type: "post", attachments: [] },
    ] });
    throw new Error("Unexpected API method");
  });
}
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-action-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  cpSync("migrations", join(directory, "migrations"), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe" });
  mocks.db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => {
  vi.clearAllMocks();
  await mocks.db.vkImportPost.deleteMany(); await mocks.db.vkImportSource.deleteMany(); await mocks.db.news.deleteMany(); await mocks.db.newsTags.deleteMany();
  await mocks.db.newsTags.create({ data: { title: "Наука", normalizedTitle: "наука" } });
  mocks.auth.mockResolvedValue({ user: { role: "admin" } });
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); vi.stubEnv("VK_GROUP_ID", "biotech.itmo"); vi.stubEnv("VK_GROUP_TOKEN", "test-secret-never-in-output");
  vi.stubGlobal("fetch", fetchMock); setupWall();
});
afterAll(async () => {
  await mocks.db?.$disconnect();
  if (directory) { if (!resolve(directory).startsWith(resolve(tmpdir(), "biotech-vk-action-"))) throw new Error("Unsafe cleanup"); rmSync(directory, { recursive: true, force: true }); }
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
describe("administrator launches real importer", () => {
  it.each([null, { user: { role: "user" } }])("rejects unauthorized access before reading source or calling VK: %j", async (session) => {
    mocks.auth.mockResolvedValue(session);
    expect(await checkVkNews()).toEqual({ ok: false, error: "Недостаточно прав для импорта новостей" });
    expect(fetchMock).not.toHaveBeenCalled(); expect(await mocks.db.vkImportSource.count()).toBe(0);
  });
  it("explains missing configuration without external calls", async () => {
    vi.stubEnv("VK_GROUP_TOKEN", "");
    expect(await checkVkNews()).toMatchObject({ ok: false, error: expect.stringContaining("VK_GROUP_TOKEN") });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("imports from the button action, invalidates news and exposes ordered public data", async () => {
    await mocks.db.news.createMany({ data: [
      { id: "manual-a", title: "Ручная A", date: "2026-10-14", text: "Текст", links: "", hidden: false },
      { id: "manual-z", title: "Ручная Z", date: "2026-10-14", text: "Текст", links: "", hidden: false },
      { id: "manual-hidden", title: "Скрыта", date: "2026-12-14", text: "Текст", links: "", hidden: true },
    ] });
    const result = await checkVkNews();
    expect(result).toMatchObject({ ok: true, data: { added: 1, skipped: 2, failed: 0, successful: true } });
    const [news, count] = await getNews();
    expect(count).toBe(3); expect(news.map((item) => item.title)).toEqual(["Ручная Z", "Ручная A", "Новая новость"]);
    expect(news[2].tags.map((tag) => tag.title)).toEqual(["Наука"]);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("news", { expire: 0 });
    const status = await getVkImportStatus();
    expect(status).toMatchObject({ configured: true, group: { id: "42" }, lastResult: { added: 1 }, lastSuccessAt: expect.any(String) });
    expect(JSON.stringify(status)).not.toContain("test-secret");
    expect((await checkVkNews())).toMatchObject({ ok: true, data: { added: 0 } });
    expect(await mocks.db.news.count()).toBe(4);
  });
  it("reports an API error safely without changing previous successful time", async () => {
    await checkVkNews(); const previous = (await getVkImportStatus()).lastSuccessAt;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { error_code: 5, error_msg: "test-secret-never-in-output", request_params: [{ key: "access_token", value: "test-secret-never-in-output" }] } })));
    const result = await checkVkNews(); expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("test-secret");
    expect((await getVkImportStatus()).lastSuccessAt).toBe(previous);
    expect(await mocks.db.news.count()).toBe(1);
  });
  it("shows new configuration without borrowing another group's status", async () => {
    await checkVkNews(); vi.stubEnv("VK_GROUP_ID", "another.group");
    expect(await getVkImportStatus()).toMatchObject({ configured: true, source: "another.group", group: null, lastResult: null, lastSuccessAt: null });
    expect(await mocks.db.news.count()).toBe(1);
  });
});

it.each([
  ["groups.getById", 5, "VK_GROUP_TOKEN"], ["groups.getById", 27, "тип токена"],
  ["wall.get", 5, "VK_GROUP_TOKEN"], ["wall.get", 27, "тип токена"],
])("preserves safe actionable API rejection for %s code %i", async (method, code, expected) => {
  const successfulResponse = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url, init) => String(url).endsWith(String(method))
    ? new Response(JSON.stringify({ error: { error_code: code, error_msg: "test-secret-never-in-output", request_params: [{ key: "access_token", value: "test-secret-never-in-output" }] } }))
    : successfulResponse(url, init));
  const result = await checkVkNews();
  const message = result.ok ? result.data.error : result.error;
  expect(message).toContain(String(expected));
  expect(JSON.stringify(result)).not.toContain("test-secret");
  if (result.ok) expect(result.data.successful).toBe(false);
  expect(await mocks.db.news.count()).toBe(0);
});
