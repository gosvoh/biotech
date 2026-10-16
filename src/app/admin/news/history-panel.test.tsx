// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VkHistoryPanel from "./history-panel";
import { queueVkNewsHistory, continueVkNewsHistory, getVkNewsHistoryDetails } from "./history-actions";
import type { VkHistoryState } from "@/lib/vk-import/types";

vi.mock("./history-actions", () => ({ queueVkNewsHistory: vi.fn(), continueVkNewsHistory: vi.fn(), getVkNewsHistoryDetails: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
let root: Root;
let container: HTMLDivElement;
const job = { id: "job-1", groupId: "42", from: "2026-09-01", to: "2026-10-14", initial: false, state: "queued", processed: 0, added: 0, updated: 0, hidden: 0, restored: 0, skipped: 0, failed: 0, queued: 0, lastSuccessAt: null, error: null } as VkHistoryState;
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text))!;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});

it("shows saved waiting progress and unresolved errors after reload, then continues only that job", async () => {
  const waiting = { ...job, state: "waiting", processed: 30, added: 20, skipped: 8, failed: 2, queued: 70, lastSuccessAt: "2026-10-14T09:00:00Z", error: "Не удалось подготовить фотографии. Повторите порцию." } as VkHistoryState;
  vi.mocked(continueVkNewsHistory).mockResolvedValue({ ok: true, data: { ...waiting, state: "completed", processed: 100, added: 90, skipped: 10, failed: 0, queued: 0, error: null } });
  await render([waiting]);
  expect(container.textContent).toContain("Ожидает повтора");
  expect(container.textContent).toContain("В очереди: 70");
  expect(container.textContent).toContain("Ошибок: 2");
  expect(container.textContent).not.toContain("Завершён");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("фотографии");
  await act(async () => button("Обработать порцию").click());
  expect(continueVkNewsHistory).toHaveBeenCalledWith("job-1");
  expect(container.textContent).toContain("Завершён");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect([...container.querySelectorAll("button")].some((item) => item.textContent?.includes("Обработать порцию"))).toBe(false);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (jobs: VkHistoryState[] = [], configured = true) => act(async () => root.render(<VkHistoryPanel configured={configured} initialJobs={jobs} today="2026-10-14" />));

it("queues the explicit Moscow period and exposes a separate continuation without starting work silently", async () => {
  vi.mocked(queueVkNewsHistory).mockResolvedValue({ ok: true, data: job });
  await render();
  expect(container.textContent).toContain("порциями");
  expect(container.textContent).toContain("ручные исключения");
  expect(container.querySelector<HTMLInputElement>('[name="from"]')?.min).toBe("2026-09-01");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(queueVkNewsHistory).toHaveBeenCalledWith("2026-09-01", "2026-10-14");
  expect(continueVkNewsHistory).not.toHaveBeenCalled();
  expect(container.textContent).toContain("В очереди");
  expect(button("Обработать порцию")).toBeDefined();
  expect(refresh).toHaveBeenCalledOnce();
});

it("disables queue and continuation when server configuration is missing", async () => {
  await render([job], false);
  expect(button("Импортировать историю").disabled).toBe(true);
  expect(button("Обработать порцию").disabled).toBe(true);
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(queueVkNewsHistory).not.toHaveBeenCalled(); expect(continueVkNewsHistory).not.toHaveBeenCalled();
});

it("fetches only the expanded job, permits reading saved history without VK configuration, and collapses details", async () => {
  vi.mocked(getVkNewsHistoryDetails).mockResolvedValue({ ok: true, data: { page: 1, pageSize: 20, total: 0, items: [] } });
  await render([job, { ...job, id: "job-2" }], false);
  expect(getVkNewsHistoryDetails).not.toHaveBeenCalled();
  const details = () => [...container.querySelectorAll<HTMLButtonElement>("button")].filter((item) => item.textContent?.includes("Подробности"));
  await act(async () => details()[1].click());
  expect(getVkNewsHistoryDetails).toHaveBeenLastCalledWith({ jobId: "job-2", page: 1, filter: "all" });
  expect(container.querySelectorAll('[aria-label="Подробности задания"]')).toHaveLength(1);
  await act(async () => details()[0].click());
  expect(getVkNewsHistoryDetails).toHaveBeenLastCalledWith({ jobId: "job-1", page: 1, filter: "all" });
  await act(async () => details()[0].click());
  expect(container.querySelector('[aria-label="Подробности задания"]')).toBeNull();
});

it("keeps the saved job and last success when continuation fails and prevents a second launch", async () => {
  let finish!: (result: Awaited<ReturnType<typeof continueVkNewsHistory>>) => void;
  vi.mocked(continueVkNewsHistory).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await render([{ ...job, processed: 30, added: 30, lastSuccessAt: "2026-10-14T09:00:00Z" }]);
  await act(async () => button("Обработать порцию").click());
  expect(button("Обработать порцию").disabled).toBe(true);
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(queueVkNewsHistory).not.toHaveBeenCalled();
  await act(async () => finish({ ok: false, error: "Источник изменился" }));
  expect(container.textContent).toContain("Обработано: 30"); expect(container.textContent).toContain("14.10.2026");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Источник изменился");
});

it("reports a changed and restored existing publication instead of calling it skipped", async () => {
  await render([{ ...job, state: "completed", processed: 1, updated: 1, restored: 1, skipped: 0 }]);
  expect(container.textContent).toContain("Обновлено: 1");
  expect(container.textContent).toContain("Скрыто: 0");
  expect(container.textContent).toContain("Восстановлено: 1");
  expect(container.textContent).toContain("Пропущено: 0");
});
