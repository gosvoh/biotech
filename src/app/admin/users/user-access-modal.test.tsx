// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfigProvider } from "antd";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { UserAccessModal } from "./user-access-modal";
import { createUser, updateUserAccess, sendUserInvitation } from "./actions";

vi.mock("./actions", () => ({ createUser: vi.fn(), updateUserAccess: vi.fn(), sendUserInvitation: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let root: Root; let container: HTMLDivElement;
const user = { id: "a", email: "a@example.test", name: "Алиса", role: "user" as const, accessStatus: "active" as const, sections: ["news" as const], createdAt: new Date(0).toISOString() };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const original = window.getComputedStyle.bind(window); vi.spyOn(window, "getComputedStyle").mockImplementation(el => original(el));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(props: Parameters<typeof UserAccessModal>[0] = { open: true, onClose: vi.fn() }) { await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><UserAccessModal {...props} /></ConfigProvider>)); }
function button(text: string) { const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === text); expect(found, text).toBeTruthy(); return found!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function email(value: string) { await act(async () => { const input = document.querySelector<HTMLInputElement>('input[type="email"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
function grants() { return [...document.querySelectorAll<HTMLInputElement>('.ant-checkbox-wrapper input:checked')].map(el => el.value); }

it("creates with a preset and manual grant, then enables a separate invitation", async () => {
  vi.mocked(createUser).mockResolvedValue({ ok: true, data: { userId: "new", role: "user", status: "active", sections: ["members", "disciplines", "scientific-works", "news"] } });
  vi.mocked(sendUserInvitation).mockResolvedValue({ ok: false, error: "Достигнут лимит отправки писем. Повторите позже." });
  await render(); expect(button("Отправить приглашение").disabled).toBe(true);
  await email("new@example.test"); await click("Команда");
  expect(grants()).toEqual(["members", "disciplines", "scientific-works"]);
  await act(async () => document.querySelector<HTMLInputElement>('input[value="news"]')!.click());
  await click("Сохранить");
  expect(createUser).toHaveBeenCalledWith({ email: "new@example.test", role: "user", sections: ["members", "disciplines", "scientific-works", "news"] });
  expect(sendUserInvitation).not.toHaveBeenCalled(); expect(button("Отправить приглашение").disabled).toBe(false);
  await click("Отправить приглашение"); expect(document.body.textContent).toContain("Ошибка приглашения"); expect(document.body.textContent).toContain("Достигнут лимит");
});
it("switches roles and news preset, prevents duplicate save and leaves failure open", async () => {
  let finish!: (value: Awaited<ReturnType<typeof updateUserAccess>>) => void;
  vi.mocked(updateUserAccess).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const onClose = vi.fn(); await render({ open: true, user, onClose });
  expect(document.querySelector<HTMLInputElement>('input[type="email"]')!.readOnly).toBe(true);
  await act(async () => document.querySelector<HTMLInputElement>('input[value="admin"]')!.click());
  expect(document.querySelector<HTMLInputElement>('input[value="news"]')!.disabled).toBe(true);
  await act(async () => document.querySelector<HTMLInputElement>('input[value="user"]')!.click());
  await click("Новости и теги"); expect(grants()).toEqual(["news"]);
  await click("Сохранить"); await click("Сохранить"); expect(updateUserAccess).toHaveBeenCalledTimes(1);
  await act(async () => finish({ ok: false, error: "Конфликт сохранения. Повторите действие." }));
  expect(document.body.textContent).toContain("Конфликт сохранения"); expect(onClose).not.toHaveBeenCalled();
});
it("disables invitations for blocked or dirty access and resets every editing session", async () => {
  const onClose = vi.fn(); await render({ open: true, user, onClose });
  await click("Команда"); expect(button("Отправить приглашение").disabled).toBe(true);
  await render({ open: false, user, onClose }); await render({ open: true, user, onClose }); expect(grants()).toEqual(["news"]);
  await render({ open: true, user: { ...user, id: "b", email: "b@example.test", sections: [], accessStatus: "blocked" }, onClose });
  expect(grants()).toEqual([]); expect(document.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe("b@example.test"); expect(button("Отправить приглашение").disabled).toBe(true);
  await render({ open: false, onClose }); await render({ open: true, onClose }); expect(document.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe(""); expect(grants()).toEqual([]);
});

it("submits the form from the keyboard and reports create errors without closing", async () => {
  vi.mocked(createUser).mockResolvedValue({ ok: false, error: "Пользователь с таким email уже существует." });
  const onClose = vi.fn(); await render({ open: true, onClose }); await email("existing@example.test");
  await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(document.body.textContent).toContain("Пользователь с таким email уже существует.");
  expect(onClose).not.toHaveBeenCalled();
});

it.each(["pending", "blocked"] as const)("cannot invite a saved %s user", async accessStatus => {
  await render({ open: true, user: { ...user, accessStatus }, onClose: vi.fn() });
  expect(button("Отправить приглашение").disabled).toBe(true);
  await click("Отправить приглашение"); expect(sendUserInvitation).not.toHaveBeenCalled();
});

it("locks an invitation until it completes and replaces unexpected transport errors with safe copy", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(sendUserInvitation).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  await render({ open: true, user, onClose: vi.fn() }); await click("Отправить приглашение");
  expect(button("Сохранить").disabled).toBe(true); expect(button("Закрыть").disabled).toBe(true);
  await click("Отправить приглашение"); expect(sendUserInvitation).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("sensitive-internal-smtp-details")));
  expect(document.body.textContent).toContain("Ошибка приглашения"); expect(document.body.textContent).not.toContain("sensitive-internal-smtp-details");
  expect(button("Отправить приглашение").disabled).toBe(false);
});
