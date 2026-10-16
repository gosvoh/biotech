// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AdminAccess } from "@/lib/admin-access";
const navigation = vi.hoisted(() => ({ path: "/admin/news", read: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.path, useRouter: () => ({ push: navigation.push }) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("./access-actions", () => ({ readOwnAdminAccess: navigation.read }));
import AdminShell from "./admin-shell";
const news: AdminAccess = { userId: "news", role: "user", status: "active", sections: ["news"] };
const team: AdminAccess = { userId: "team", role: "user", status: "active", sections: ["members"] };
let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }, media: "", onchange: null });
});
beforeEach(() => { navigation.path = "/admin/news"; navigation.read.mockReset(); navigation.read.mockResolvedValue(news); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = (initialAccess = news) => root.render(<AdminShell initialAccess={initialAccess}>CONTENT</AdminShell>);
it("refreshes own grants on pathname changes while a layout stays mounted and hides revoked entries", async () => {
  await act(async () => render()); expect(container.textContent).toContain("Теги новостей"); expect(container.textContent).not.toContain("Пользователи");
  let resolve!: (access: AdminAccess | null) => void;
  navigation.read.mockImplementationOnce(() => new Promise<AdminAccess | null>(done => { resolve = done; }));
  navigation.path = "/admin/members";
  await act(async () => render());
  expect(container.textContent).not.toContain("Теги новостей");
  await act(async () => resolve(team));
  expect(container.textContent).toContain("Команда"); expect(container.textContent).not.toContain("Теги новостей");
  navigation.read.mockResolvedValueOnce(null); navigation.path = "/admin/forbidden";
  await act(async () => render()); expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
});
it("ignores late replies from previous navigation and reloads access on refreshed server props", async () => {
  let resolveOld!: (access: AdminAccess | null) => void;
  navigation.read.mockImplementationOnce(() => new Promise<AdminAccess | null>(done => { resolveOld = done; }));
  await act(async () => render());
  navigation.path = "/admin/members"; navigation.read.mockResolvedValueOnce(team);
  await act(async () => render()); await act(async () => resolveOld(news));
  expect(container.textContent).not.toContain("Теги новостей");
  const revoked = { ...team, sections: [] };
  navigation.read.mockResolvedValueOnce(revoked);
  await act(async () => render(revoked));
  expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
});
