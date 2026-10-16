// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VkHistoryDetails from "./history-details";
import { getVkNewsHistoryDetails } from "./history-actions";
import type { VkHistoryDetailsPage } from "@/lib/vk-import/types";

vi.mock("./history-actions", () => ({ getVkNewsHistoryDetails: vi.fn() }));
let root: Root, container: HTMLDivElement;
const result = (text: string, page = 1, total = 1): { ok: true; data: VkHistoryDetailsPage } => ({ ok: true, data: {
  page, total, pageSize: 20, items: [{ postId: "123", sourceUrl: "https://vk.com/wall-42_123", state: "done", outcome: "skipped", reasonCode: "selection_rejected", reasonText: text }],
} });
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text))!;
const filter = async (text: string) => act(async () => [...container.querySelectorAll("label")].find((item) => item.textContent === text)!.click());
const render = async (jobId = "first", refreshKey = "0") => act(async () => root.render(<VkHistoryDetails jobId={jobId} refreshKey={refreshKey} />));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it("ignores late filter and job responses and resets a newly selected job to all on page one", async () => {
  const requests: { input: unknown; finish: (value: Awaited<ReturnType<typeof getVkNewsHistoryDetails>>) => void }[] = [];
  vi.mocked(getVkNewsHistoryDetails).mockImplementation((input) => new Promise((finish) => { requests.push({ input, finish }); }));
  await render();
  expect(container.textContent).toContain("Загружаем подробности");
  await filter("Пропущено");
  expect(requests[1].input).toEqual({ jobId: "first", page: 1, filter: "skipped" });
  await act(async () => requests[1].finish(result("Актуальный фильтр")));
  await act(async () => requests[0].finish(result("Устаревший фильтр")));
  expect(container.textContent).toContain("Актуальный фильтр");
  expect(container.textContent).not.toContain("Устаревший фильтр");
  await filter("Ошибки");
  await render("second");
  expect(container.textContent).not.toContain("Актуальный фильтр");
  expect(requests[3].input).toEqual({ jobId: "second", page: 1, filter: "all" });
  await act(async () => requests[3].finish(result("Другое задание")));
  await act(async () => requests[2].finish(result("Первое задание")));
  expect(container.textContent).toContain("Другое задание");
  expect(container.textContent).not.toContain("Первое задание");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("https://vk.com/wall-42_123");
});

it("offers retry after failure, pages twenty rows, resets filter page and accepts a server-clamped page", async () => {
  const load = vi.mocked(getVkNewsHistoryDetails);
  load.mockResolvedValueOnce({ ok: false, error: "Сбой загрузки" }).mockResolvedValueOnce(result("Страница 1", 1, 41));
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Сбой загрузки");
  await act(async () => button("Повторить").click());
  expect(container.textContent).toContain("Страница 1");
  load.mockResolvedValueOnce(result("Страница 2", 2, 41));
  await act(async () => container.querySelector<HTMLElement>('[title="2"]')!.click());
  expect(load).toHaveBeenLastCalledWith({ jobId: "first", page: 2, filter: "all" });
  load.mockResolvedValueOnce(result("Стало меньше", 1, 1));
  await render("first", "1");
  expect(container.textContent).toContain("Стало меньше");
  expect(container.querySelector(".ant-pagination-item-active")?.textContent).toBe("1");
  expect(load).toHaveBeenCalledTimes(4);
  load.mockResolvedValueOnce(result("Снова больше", 1, 61));
  await render("first", "2");
  expect(load).toHaveBeenLastCalledWith({ jobId: "first", page: 1, filter: "all" });
  expect(container.querySelector(".ant-pagination-item-active")?.textContent).toBe("1");
  load.mockResolvedValueOnce({ ok: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
  await filter("Ошибки");
  expect(load).toHaveBeenLastCalledWith({ jobId: "first", page: 1, filter: "failed" });
  expect(container.textContent).toContain("Ошибок в этом задании нет");
});

it("ignores a stale clamp without changing the active filter's page", async () => {
  const load = vi.mocked(getVkNewsHistoryDetails);
  load.mockResolvedValueOnce(result("Все", 1, 61));
  await render();
  let oldPage!: (value: Awaited<ReturnType<typeof getVkNewsHistoryDetails>>) => void;
  load.mockImplementationOnce(() => new Promise((resolve) => { oldPage = resolve; }));
  await act(async () => container.querySelector<HTMLElement>('[title="3"]')!.click());
  load.mockResolvedValueOnce(result("Ошибки", 1, 61));
  await filter("Ошибки");
  load.mockResolvedValueOnce(result("Ошибки, страница 2", 2, 61));
  await act(async () => container.querySelector<HTMLElement>('[title="2"]')!.click());
  await act(async () => oldPage(result("Старое сокращение", 1, 1)));
  expect(container.textContent).not.toContain("Старое сокращение");
  load.mockResolvedValueOnce(result("Обновлённые ошибки", 2, 61));
  await render("first", "1");
  expect(load).toHaveBeenLastCalledWith({ jobId: "first", page: 2, filter: "failed" });
  expect(container.querySelector(".ant-pagination-item-active")?.textContent).toBe("2");
});

it("handles a rejected request safely and shows pending and old records without inventing links", async () => {
  const load = vi.mocked(getVkNewsHistoryDetails);
  load.mockRejectedValueOnce(new Error("PRIVATE_SECRET"));
  await render();
  expect(container.textContent).not.toContain("PRIVATE_SECRET");
  const data = result("Подробная причина не сохранена для этой записи").data;
  data.items[0] = { ...data.items[0], state: "pending", outcome: null, sourceUrl: null, reasonCode: null };
  load.mockResolvedValueOnce({ ok: true, data });
  await act(async () => button("Повторить").click());
  expect(container.textContent).toContain("В очереди");
  expect(container.textContent).toContain("Подробная причина не сохранена");
  expect(container.querySelector("tbody a")).toBeNull();
});
