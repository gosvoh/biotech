// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VkImportPanel from "./import-panel";
import { checkVkNews, recheckVkNewsTags } from "./import-actions";
import type { VkImportStatus } from "@/lib/vk-import/types";

vi.mock("./automation-actions", () => ({ setVkNewsAutomation: vi.fn() }));
vi.mock("./import-actions", () => ({ checkVkNews: vi.fn(), recheckVkNewsTags: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const configured: VkImportStatus = {
  configured: true, source: "biotech.itmo", group: null, lastAttemptAt: null,
  lastSuccessAt: null, lastResult: null, error: null,
};
let root: Root;
let container: HTMLDivElement;
async function render(status = configured) {
  await act(async () => root.render(<VkImportPanel initialStatus={status} />));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe("manual VK import panel", () => {
  it("explains new-post check and bootstrap scope, and does not claim access was verified", async () => {
    await render();
    expect(container.textContent).toContain("biotech.itmo");
    expect(container.textContent).toContain("Доступ ещё не проверен");
    expect(container.textContent).toContain("30 последних");
    expect(container.textContent).toContain("новые публикации");
    expect(container.textContent).not.toContain("Токен");
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
  });
  it("disables check and explains missing server configuration", async () => {
    await render({ ...configured, configured: false, error: "Укажите VK_GROUP_TOKEN в настройках сервера" });
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("VK_GROUP_TOKEN");
  });
  it("shows counters and success time after the authorized action, refreshing news", async () => {
    const group = { id: "42", name: "Биотех ИТМО", screenName: "biotech.itmo" };
    vi.mocked(checkVkNews).mockResolvedValue({ ok: true, data: { group, successful: true, added: 2, skipped: 3, failed: 0, startedAt: "2026-10-13T19:00:00Z", finishedAt: "2026-10-13T19:01:00Z", lastSuccessAt: "2026-10-13T19:01:00Z", error: null, reasons: [{ postId: "3", reason: "Репосты не импортируются" }] } });
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(checkVkNews).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Добавлено: 2");
    expect(container.textContent).toContain("Пропущено: 3");
    expect(container.textContent).toContain("Ошибок: 0");
    expect(container.textContent).toContain("Последняя успешная проверка");
    expect(container.textContent).toContain("Репосты не импортируются");
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("keeps last success and explains failure rather than reporting success", async () => {
    vi.mocked(checkVkNews).mockResolvedValue({ ok: false, error: "ВК отклонил токен" });
    await render({ ...configured, lastSuccessAt: "2026-10-12T19:01:00Z", lastResult: { group: { id: "42", name: "Биотех", screenName: "biotech.itmo" }, successful: true, added: 1, skipped: 0, failed: 0, startedAt: "2026-10-12T19:00:00Z", finishedAt: "2026-10-12T19:01:00Z", lastSuccessAt: "2026-10-12T19:01:00Z", error: null, reasons: [] } });
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("ВК отклонил токен");
    expect(container.textContent).toContain("12.10.2026");
    expect(container.textContent).not.toContain("Проверка завершена");
  });
  it("blocks double launch while waiting", async () => {
    let finish!: (value: Awaited<ReturnType<typeof checkVkNews>>) => void;
    vi.mocked(checkVkNews).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
    await act(async () => finish({ ok: false, error: "Не удалось подключиться к ВК" }));
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
  });
});

it("shows a durable tag recheck waiting after failure and retries only the bounded tag operation", async () => {
  const queued = { revision: 2, appliedRevision: 1, pending: true, lastAttemptAt: null, lastSuccessAt: null, error: "Пересмотр тегов ожидает повтора" };
  vi.mocked(recheckVkNewsTags).mockResolvedValue({ ok: true, data: { ...queued, pending: false, appliedRevision: 2, error: null, group: { id: "42", name: "Биотех", screenName: "biotech.itmo" }, checked: 30, added: 1, skipped: 29, failed: 0, successful: true } });
  await act(async () => root.render(<VkImportPanel initialStatus={configured} initialTagStatus={queued} />));
  expect(container.textContent).toContain("Пересмотр тегов ожидает повтора");
  const retry = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("Повторить пересмотр тегов"));
  expect(retry).toBeDefined();
  await act(async () => retry!.click());
  expect(recheckVkNewsTags).toHaveBeenCalledOnce(); expect(checkVkNews).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Пересмотр тегов завершён");
});

it("explains a saved manual check queue without reporting completion or failure", async () => {
  vi.mocked(checkVkNews).mockResolvedValue({ ok: true, data: { queued: true, group: { id: "42", name: "Биотех", screenName: "biotech.itmo" }, successful: false, added: 0, skipped: 0, failed: 0, startedAt: "2026-10-14T19:00:00Z", finishedAt: "2026-10-14T19:00:00Z", lastSuccessAt: null, error: null, reasons: [] } });
  await render();
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
  expect(container.textContent).toContain("Проверка сохранена в очереди");
  expect(container.textContent).not.toContain("Проверка завершена с ошибками");
  expect(container.textContent).toContain("при выключенном расписании");
  expect(refresh).toHaveBeenCalledOnce();
});
