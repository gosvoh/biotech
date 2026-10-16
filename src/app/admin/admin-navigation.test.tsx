import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminAccess } from "@/lib/admin-access";
import { createAuthFixture } from "@/lib/auth-test-fixture";
const context = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/auth", () => ({ auth: async () => context.id ? { user: { id: context.id, role: "admin" } } : null, signIn: async () => { throw new Error("SIGNIN"); } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let page: typeof import("./page");
let nav: typeof import("./admin-nav");
beforeAll(async () => { fixture = await createAuthFixture(); vi.doMock("@/prisma", () => ({ prisma: fixture.db })); page = await import("./page"); nav = await import("./admin-nav"); }, 30000);
beforeEach(async () => { await fixture.reset(); context.id = null; vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); });
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
const access = (sections: AdminAccess["sections"], role: AdminAccess["role"] = "user", status: AdminAccess["status"] = "active"): AdminAccess => ({ userId: "local", role, status, sections });
it("filters desktop/drawer menu entries by active section grants, including tags and full-admin users", () => {
  expect(nav.getAdminMenuItems(access(["news"]))?.map(i => i?.key)).toEqual(["/admin/news", "/admin/tags"]);
  expect(nav.getAdminMenuItems(access(["members"]))?.map(i => i?.key)).toEqual(["/admin/members"]);
  expect(nav.getAdminMenuItems(access([], "admin"))).toHaveLength(7);
  expect(nav.getAdminMenuItems(access(["news"], "admin", "blocked"))).toEqual([]);
  expect(nav.getAdminMenuItems(null)).toEqual([]);
});
it("shows useful no-access content on /admin without looping when active user has no assignments", async () => {
  const user = await fixture.db.user.create({ data: { role: "user", accessStatus: "active" } }); context.id = user.id;
  expect(renderToStaticMarkup(await page.default())).toContain("Вам пока не назначены разделы");
});
it.each([["user", "members", "/admin/members"], ["user", "news", "/admin/news"], ["admin", null, "/admin/news"]])("lands %s with %s grants at %s", async (role, section, url) => {
  const user = await fixture.db.user.create({ data: { role: role!, accessStatus: "active", sectionPermissions: section ? { create: { section } } : undefined } }); context.id = user.id;
  await expect(page.default()).rejects.toThrow(`REDIRECT:${url}`);
});
it("anonymous and blocked accounts cannot enter the landing page", async () => {
  await expect(page.default()).rejects.toThrow("SIGNIN");
  const user = await fixture.db.user.create({ data: { role: "admin", accessStatus: "blocked" } }); context.id = user.id;
  await expect(page.default()).rejects.toThrow("REDIRECT:/admin/forbidden");
});
