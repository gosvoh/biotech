// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import UsersClient from "./page.client";
import { deleteUser, sendUserInvitation, setUserBlocked } from "./actions";
import type { AdminUserView } from "./types";

vi.mock("./actions", () => ({ createUser: vi.fn(), updateUserAccess: vi.fn(), sendUserInvitation: vi.fn(), setUserBlocked: vi.fn(), deleteUser: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(el => original(el));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});

it("activates pending access through an email confirmation without sending an invitation", async () => {
  vi.mocked(setUserBlocked).mockResolvedValue({ ok: true, data: undefined });
  await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App><UsersClient userId="self" users={[
    { id: "pending", email: "pending@example.test", name: "Ожидающий", role: "user", accessStatus: "pending", sections: ["news"], createdAt: new Date(0).toISOString() },
    { id: "active", email: "active@example.test", name: "Активный", role: "user", accessStatus: "active", sections: [], createdAt: new Date(0).toISOString() },
    { id: "blocked", email: "blocked@example.test", name: "Заблокированный", role: "user", accessStatus: "blocked", sections: [], createdAt: new Date(0).toISOString() },
  ]} /></App></ConfigProvider>));
  const card = (email: string) => [...container.querySelectorAll(".ant-card")].find(el => el.textContent?.includes(email))!;
  const activate = [...card("pending@example.test").querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === "Предоставить доступ");
  expect(activate).toBeTruthy();
  expect(card("active@example.test").textContent).toContain("Заблокировать");
  expect(card("blocked@example.test").textContent).toContain("Разблокировать");
  await act(async () => activate!.click());
  expect(setUserBlocked).not.toHaveBeenCalled();
  const confirmation = document.querySelector('[role="tooltip"]')!;
  expect(confirmation.textContent).toContain("Предоставить доступ пользователю?");
  expect(confirmation.textContent).toContain("pending@example.test");
  await act(async () => [...confirmation.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === "Подтвердить")!.click());
  expect(setUserBlocked).toHaveBeenCalledExactlyOnceWith("pending", false);
  expect(container.textContent).toContain("Доступ пользователю предоставлен.");
  expect(sendUserInvitation).not.toHaveBeenCalled();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(["pending", "active", "blocked"] as const)("identifies %s accounts without email in status and delete confirmations", async accessStatus => {
  const statuses = { pending: "Предоставить доступ", active: "Заблокировать", blocked: "Разблокировать" };
  const renderUser = async (name: string | null) => {
    const user: AdminUserView = { id: "stable-user-42", name, email: null, role: "user", accessStatus, sections: [], createdAt: new Date(0).toISOString() };
    await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App><UsersClient key={name ?? "unnamed"} users={[user]} /></App></ConfigProvider>));
  };
  for (const name of ["Сотрудник без email", null]) {
    await renderUser(name);
    const click = async (label: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === label)!.click());
    await click(statuses[accessStatus]);
    let confirmation = [...document.querySelectorAll<HTMLElement>(".ant-popconfirm")].find(element => !element.classList.contains("ant-popover-hidden"))!;
    expect(confirmation.textContent).toContain(name ?? "stable-user-42");
    await act(async () => [...confirmation.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Отмена")!.click());
    await click("Удалить");
    confirmation = [...document.querySelectorAll<HTMLElement>(".ant-popconfirm")].find(element => element.textContent?.includes("Удалить пользователя?"))!;
    expect(confirmation.textContent).toContain(name ?? "stable-user-42");
    expect(confirmation.textContent).toContain("Доступ, сессии и ссылки для входа будут отозваны");
    await act(async () => [...confirmation.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Отмена")!.click());
    await click("Настроить доступ");
    const invitation = [...document.querySelectorAll<HTMLButtonElement>(".ant-modal button")].find(button => button.textContent === "Отправить приглашение")!;
    expect(invitation.disabled).toBe(true);
    await act(async () => (document.querySelector(".ant-modal-close") as HTMLButtonElement).click());
  }
  expect(setUserBlocked).not.toHaveBeenCalled(); expect(sendUserInvitation).not.toHaveBeenCalled(); expect(deleteUser).not.toHaveBeenCalled();
});
it("finds users by name/email and filters status and type on mobile cards", async () => {
  await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App><UsersClient userId="self" users={[
    { id: "a", email: "alice@example.test", name: "Алиса", role: "user", accessStatus: "active", sections: ["news"], createdAt: new Date(0).toISOString() },
    { id: "b", email: "bob@example.test", name: "Борис", role: "admin", accessStatus: "blocked", sections: [], createdAt: new Date(0).toISOString() },
  ]} /></App></ConfigProvider>));
  expect(container.textContent).toContain("Добавить пользователя");
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Поиск по имени или email"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, " АЛИСА "); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(container.textContent).toContain("alice@example.test"); expect(container.textContent).not.toContain("bob@example.test");
  expect(container.textContent).toContain("Найдено: 1");
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, " ALICE@EXAMPLE.TEST "); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(container.textContent).toContain("alice@example.test"); expect(container.textContent).not.toContain("bob@example.test");
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Очистить поиск"]')!.click());
  expect(container.textContent).toContain("Найдено: 2");
  const status = container.querySelector<HTMLInputElement>('input[aria-label="Статус доступа"]')!;
  await act(async () => { status.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
  const blocked = [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].find(el => el.textContent === "Заблокирован")!;
  await act(async () => blocked.click());
  expect(container.textContent).not.toContain("alice@example.test"); expect(container.textContent).toContain("bob@example.test");
  await act(async () => { status.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
  await act(async () => [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].find(el => el.textContent === "Все статусы")!.click());
  const type = container.querySelector<HTMLInputElement>('input[aria-label="Тип доступа"]')!;
  await act(async () => { type.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
  await act(async () => [...document.querySelectorAll<HTMLElement>(".ant-select-item-option")].find(el => el.textContent === "Администратор")!.click());
  expect(container.textContent).not.toContain("alice@example.test"); expect(container.textContent).toContain("bob@example.test");
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "nobody@example.test"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(container.textContent).toContain("Ничего не найдено");
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Очистить поиск"]')!.click());
  expect(container.textContent).toContain("bob@example.test");
  expect(container.textContent).not.toContain("alice@example.test");
  expect(container.textContent).toContain("Найдено: 1");
});
