// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VkNewsControls from "./vk-controls";
import { checkVkNewsPost, disableVkNewsSync, enableVkNewsSync } from "../vk-actions";
import { changeVisibility } from "../actions";
import type { VkNewsState } from "@/lib/vk-import/types";

vi.mock("../vk-actions", () => ({ checkVkNewsPost: vi.fn(), disableVkNewsSync: vi.fn(), enableVkNewsSync: vi.fn() }));
vi.mock("../actions", () => ({ changeVisibility: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const state: VkNewsState = { groupId: "42", postId: "101", syncEnabled: true, manualHidden: false, manualDeleted: false, autoHiddenReason: null, lastCheckedAt: "2026-10-13T19:00:00Z", lastCheckError: null };
let root: Root;
let container: HTMLDivElement;
async function render(value = state, canCheck = true) {
  await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App><VkNewsControls newsId="news-id" state={value} canCheck={canCheck} /></App></ConfigProvider>));
}
function button(text: string) { return [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text))!; }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => computedStyle(element));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("VK news editor controls", () => {
  it("explains sync editing lock, source and successful check", async () => {
    await render();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://vk.ru/wall-42_101");
    expect(container.textContent).toContain("Отключите, чтобы редактировать");
    expect(container.textContent).toContain("13.10.2026");
    expect(container.textContent).toContain("вне окна");
  });
  it("shows separate manual and automatic hidden reasons", async () => {
    await render({ ...state, manualHidden: true, autoHiddenReason: "Оригинал удалён в ВК", lastCheckError: "ВК отклонил токен" });
    expect(container.textContent).toContain("Скрыта редактором");
    expect(container.textContent).toContain("Оригинал удалён в ВК");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("ВК отклонил токен");
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  });
  it("checks an individual old post and disables synchronization independently", async () => {
    vi.mocked(checkVkNewsPost).mockResolvedValue({ ok: true, data: {} as never });
    vi.mocked(disableVkNewsSync).mockResolvedValue({ ok: true, data: {} as never });
    await render();
    await act(async () => button("Проверить эту новость").click());
    expect(checkVkNewsPost).toHaveBeenCalledWith("news-id");
    await act(async () => button("Отключить синхронизацию").click());
    expect(disableVkNewsSync).toHaveBeenCalledWith("news-id");
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("requires replacement confirmation before re-enabling", async () => {
    vi.mocked(enableVkNewsSync).mockResolvedValue({ ok: true, data: {} as never });
    await render({ ...state, syncEnabled: false });
    await act(async () => button("Включить синхронизацию").click());
    expect(enableVkNewsSync).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Ручные правки текста и фотографий будут заменены");
    await act(async () => button("Включить и заменить").click());
    expect(enableVkNewsSync).toHaveBeenCalledWith("news-id");
  });
  it("changes only the editor's manual hidden decision", async () => {
    vi.mocked(changeVisibility).mockResolvedValue({ ok: true, data: {} as never });
    await render();
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(changeVisibility).toHaveBeenCalledWith("news-id", true);
  });
  it("allows disabling sync after source change but blocks a source check", async () => {
    await render(state, false);
    expect(button("Проверить эту новость").disabled).toBe(true);
    expect(button("Отключить синхронизацию").disabled).toBe(false);
    expect(container.textContent).toContain("текущего источника");
  });
});
