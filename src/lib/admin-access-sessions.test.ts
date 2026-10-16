import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { createAuthFixture } from "./auth-test-fixture";
import type { VkApi } from "./vk-import/types";
const context = vi.hoisted(() => ({ store: null as unknown as import("node:async_hooks").AsyncLocalStorage<Headers> }));
vi.mock("next/headers", () => ({ headers: async () => context.store.getStore() ?? new Headers({ host: "localhost:3000" }), cookies: async () => ({ getAll: () => [], set() {} }) }));
vi.mock("next/cache", () => ({ revalidateTag() {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("nodemailer", async original => {
  const actual = await original<typeof import("nodemailer")>();
  return { ...actual, createTransport: () => actual.createTransport({ jsonTransport: true }) };
});
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let guards: typeof import("./admin-access.server");
let own: typeof import("@/app/admin/access-actions");
let mutations: typeof import("@/app/admin/tags/actions");
let users: typeof import("./admin-users");
beforeAll(async () => {
  context.store = new AsyncLocalStorage<Headers>(); fixture = await createAuthFixture();
  vi.stubEnv("DATABASE_URL", fixture.url); vi.stubEnv("AUTH_SECRET", "task-five-test-secret-never-production");
  vi.stubEnv("AUTH_URL", "http://localhost:3000/api/auth"); vi.stubEnv("AUTH_TRUST_HOST", "true");
  vi.stubEnv("EMAIL_SERVER_HOST", "local-json-transport.invalid"); vi.stubEnv("EMAIL_SERVER_USER", "test@example.test");
  vi.stubEnv("EMAIL_SERVER_PASSWORD", "test-only"); vi.stubEnv("EMAIL_FROM", "test@example.test");
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false");
  vi.doMock("@/prisma", () => ({ prisma: fixture.db }));
  guards = await import("./admin-access.server"); own = await import("@/app/admin/access-actions");
  mutations = await import("@/app/admin/tags/actions"); users = await import("./admin-users");
}, 30000);
beforeEach(async () => { await fixture.reset(); await fixture.db.news.deleteMany(); await fixture.db.newsTags.deleteMany(); await fixture.db.vkImportSource.deleteMany(); await fixture.db.vkAutomationRuntime.deleteMany(); });
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
async function session(id: string, role: string, section?: string) {
  await fixture.db.user.create({ data: { id, email: `${id}@example.test`, role, accessStatus: "active", sectionPermissions: section ? { create: { section } } : undefined } });
  await fixture.db.session.create({ data: { userId: id, sessionToken: `${id}-session`, expires: new Date(Date.now() + 600000) } });
  return <T>(fn: () => Promise<T>) => context.store.run(new Headers({ host: "localhost:3000", cookie: `authjs.session-token=${id}-session` }), fn);
}
it("isolates real news/team Auth.js sessions in parallel and observes revoked grants on their existing cookies", async () => {
  const news = await session("news", "user", "news"); const team = await session("team", "user", "members");
  const [newsAccess, teamAccess] = await Promise.all([news(own.readOwnAdminAccess), team(own.readOwnAdminAccess)]);
  expect(newsAccess).toEqual({ userId: "news", role: "user", status: "active", sections: ["news"] });
  expect(teamAccess).toEqual({ userId: "team", role: "user", status: "active", sections: ["members"] });
  expect(await news(() => mutations.addNewsTags("Science"))).toMatchObject({ ok: true });
  expect(await team(() => mutations.addNewsTags("Forbidden"))).toMatchObject({ ok: false });
  await fixture.db.userSectionPermission.deleteMany({ where: { userId: "news" } });
  expect((await news(own.readOwnAdminAccess))?.sections).toEqual([]);
  expect(await news(() => mutations.addNewsTags("Revoked"))).toMatchObject({ ok: false });
  expect(await fixture.db.session.count()).toBe(2);
  expect((await fixture.db.newsTags.findMany()).map(t => t.title)).toEqual(["Science"]);
});
it("blocking the editor revokes future actions while saved history and enabled automation continue through the system worker", async () => {
  await session("admin", "admin"); const editor = await session("editor", "user", "news");
  const { enableVkAutomation, tickVkAutomation, getVkAutomationState } = await import("./vk-import/automation");
  const { runVkWorker } = await import("./vk-import/worker-runtime");
  const api: VkApi = { getGroup: async () => ({ id: "42", name: "Local", screenName: "local" }), getWall: async () => ({ items: [], count: 0 }), getPosts: async () => [] };
  const options = { db: fixture.db, api, images: { prepare: async () => [], discard: async () => {} }, invalidate() {}, now: () => new Date("2026-10-16T12:00:00Z"), currentGroupId: "42" };
  const accepted = await enableVkAutomation(options);
  expect(accepted.initialHistoryId).toBeTruthy();
  const jobBefore = await fixture.db.vkHistoryJob.findUniqueOrThrow({ where: { id: accepted.initialHistoryId! } });
  await users.setAdminUserBlocked(fixture.db, "admin", "editor", true);
  expect(await editor(() => mutations.addNewsTags("Forbidden"))).toMatchObject({ ok: false });
  await expect(editor(() => guards.requireAdminSection("news"))).rejects.toThrow();
  expect(await fixture.db.vkHistoryJob.findUnique({ where: { id: jobBefore.id } })).toEqual(jobBefore);
  expect((await getVkAutomationState(fixture.db, "42")).enabled).toBe(true);
  const stop = new AbortController();
  await editor(() => runVkWorker({ signal: stop.signal, flush: async () => {}, disconnect: async () => {}, tick: async () => { await tickVkAutomation(options); stop.abort(); return false; } }));
  expect((await getVkAutomationState(fixture.db, "42")).lastNewAt).toBe("2026-10-16T12:00:00.000Z");
  expect((await fixture.db.vkHistoryJob.findUniqueOrThrow({ where: { id: jobBefore.id } })).state).toBe("completed");
  expect(await fixture.db.session.findFirst({ where: { userId: "editor" } })).toBeNull();
});
