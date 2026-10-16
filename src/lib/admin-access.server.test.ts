import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { createAuthFixture } from "./auth-test-fixture";
import { ADMIN_SECTIONS } from "./admin-access";
const context = vi.hoisted(() => ({ id: null as string | null, role: "admin" }));
vi.mock("@/auth", () => ({ auth: async () => context.id ? { user: { id: context.id, role: context.role } } : null, signIn: async () => { throw new Error("SIGNIN"); } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let guards: typeof import("./admin-access.server");
beforeAll(async () => {
  fixture = await createAuthFixture();
  vi.doMock("@/prisma", () => ({ prisma: fixture.db }));
  guards = await import("./admin-access.server");
}, 30000);
beforeEach(async () => { await fixture.reset(); context.id = null; context.role = "admin"; vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); });
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
async function account(role = "user", status = "active", sections: string[] = []) {
  const user = await fixture.db.user.create({ data: { role, accessStatus: status, sectionPermissions: { create: sections.map(section => ({ section })) } } });
  context.id = user.id;
  return user;
}
it.each(ADMIN_SECTIONS.map(s => s.code))("reads fresh %s grants and rejects all other sections despite a stale admin session role", async section => {
  await account("user", "active", [section]);
  expect(await guards.getCurrentAdminAccess()).toEqual({ userId: context.id, role: "user", status: "active", sections: [section] });
  for (const entry of ADMIN_SECTIONS) {
    if (entry.code === section) expect((await guards.requireAdminSection(entry.code)).userId).toBe(context.id);
    else await expect(guards.requireAdminSection(entry.code)).rejects.toThrow("Недостаточно прав");
  }
  await expect(guards.requireFullAdmin()).rejects.toThrow("Недостаточно прав");
});
it.each(["pending", "blocked"])("rejects %s admins and editors for mutations and protected pages", async status => {
  for (const role of ["admin", "user"]) {
    await account(role, status, ["news"]);
    expect((await guards.getCurrentAdminAccess())?.status).toBe(status);
    await expect(guards.requireAdminSection("news")).rejects.toThrow("Недостаточно прав");
    await expect(guards.requireFullAdmin()).rejects.toThrow("Недостаточно прав");
    await expect(guards.requireAdminSectionPage("news")).rejects.toThrow("REDIRECT:/admin/forbidden");
  }
});
it("allows active full admins even when the session role is user; returns only safe fields", async () => {
  await account("admin"); context.role = "user";
  for (const entry of ADMIN_SECTIONS) await expect(guards.requireAdminSection(entry.code)).resolves.toMatchObject({ role: "admin" });
  expect(Object.keys(await guards.requireFullAdmin()).sort()).toEqual(["role", "sections", "status", "userId"]);
});
it("denies anonymous/deleted identities and starts sign-in for anonymous pages", async () => {
  expect(await guards.getCurrentAdminAccess()).toBeNull();
  await expect(guards.requireAdminSection("news")).rejects.toThrow("Недостаточно прав");
  await expect(guards.requireAdminSectionPage("news")).rejects.toThrow("SIGNIN");
  context.id = "deleted";
  expect(await guards.getCurrentAdminAccess()).toBeNull();
});
it("never caches across two users or after revocation within the same session", async () => {
  const news = await account("user", "active", ["news"]);
  const team = await account("user", "active", ["members"]);
  context.id = news.id; expect((await guards.requireAdminSection("news")).sections).toEqual(["news"]);
  context.id = team.id; await expect(guards.requireAdminSection("news")).rejects.toThrow();
  context.id = news.id;
  await fixture.db.userSectionPermission.deleteMany({ where: { userId: news.id } });
  await expect(guards.requireAdminSection("news")).rejects.toThrow();
  expect((await guards.getCurrentAdminAccess())?.sections).toEqual([]);
});
it("fails closed on unknown role/status, filters unknown grants and never enables dev bypass in production", async () => {
  await account("owner", "active", ["news"]); expect(await guards.getCurrentAdminAccess()).toBeNull();
  await account("user", "future", ["news"]); expect(await guards.getCurrentAdminAccess()).toBeNull();
  await account("user", "active", ["future", "news"]); expect((await guards.getCurrentAdminAccess())?.sections).toEqual(["news"]);
  context.id = null;
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DISABLE_ADMIN_AUTH", "true");
  expect(await guards.getCurrentAdminAccess()).toBeNull();
  vi.stubEnv("NODE_ENV", "development");
  expect((await guards.requireFullAdmin()).role).toBe("admin");
});
it("own-access server read action uses only current identity and fresh grants", async () => {
  const action = await import("@/app/admin/access-actions");
  const news = await account("user", "active", ["news"]);
  expect(await action.readOwnAdminAccess()).toEqual({ userId: news.id, role: "user", status: "active", sections: ["news"] });
  const team = await account("user", "active", ["members"]);
  expect((await action.readOwnAdminAccess())?.userId).toBe(team.id);
  expect((await action.readOwnAdminAccess())?.sections).toEqual(["members"]);
  context.id = news.id;
  await fixture.db.userSectionPermission.deleteMany({ where: { userId: news.id } });
  expect((await action.readOwnAdminAccess())?.sections).toEqual([]);
});
it("legacy requireAdmin and requireAdminPage remain full-admin guards", async () => {
  const legacy = await import("./utils.server");
  await account("user", "active", ["news"]);
  await expect(legacy.requireAdmin()).rejects.toThrow("Недостаточно прав");
  await expect(legacy.requireAdminPage()).rejects.toThrow("REDIRECT:/admin/forbidden");
  await account("admin");
  expect((await legacy.requireAdmin()).role).toBe("admin");
  expect((await legacy.requireAdminPage()).role).toBe("admin");
});
