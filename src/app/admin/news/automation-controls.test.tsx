// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VkAutomationControls from "./automation-controls";
import { setVkNewsAutomation } from "./automation-actions";
import type { VkAutomationState } from "@/lib/vk-import/types";
vi.mock("./automation-actions", () => ({ setVkNewsAutomation: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const off: VkAutomationState = { groupId: null, enabled: false, initialHistoryId: null, initialState: null, lastNewAt: null, lastSyncAt: null, nextNewAt: null, nextSyncAt: null, lastWorkerAt: null, error: null, running: false, queued: false };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (state = off, configured = true) => act(async () => root.render(<VkAutomationControls initialState={state} configured={configured} source="biotech.itmo" />));

it("starts OFF, explains both intervals and initial history, and only enables after server confirmation", async () => {
  vi.mocked(setVkNewsAutomation).mockResolvedValue({ ok: true, data: { ...off, groupId: "42", enabled: true, queued: true, nextNewAt: "2026-10-14T12:15:00Z", nextSyncAt: "2026-10-15T12:00:00Z" } });
  await render();
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  expect(container.textContent).toContain("15 минут"); expect(container.textContent).toContain("раз в сутки"); expect(container.textContent).toContain("30 последних");
  expect(container.textContent).toContain("1 сентября");
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(setVkNewsAutomation).toHaveBeenCalledWith(true, "biotech.itmo", null);
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
  expect(refresh).toHaveBeenCalledOnce();
});

it("keeps OFF after failed access and shows the reason without announcing enabled", async () => {
  vi.mocked(setVkNewsAutomation).mockResolvedValue({ ok: false, error: "ВК не разрешил чтение стены" });
  await render(); await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("чтение стены");
  expect(container.textContent).not.toContain("Расписание включено");
});

it("blocks first activation without configuration but still lets an enabled source be switched OFF", async () => {
  await render(off, false); expect(container.querySelector<HTMLButtonElement>('[role="switch"]')!.disabled).toBe(true);
  expect(container.textContent).toContain("ВК не подключён");
  vi.mocked(setVkNewsAutomation).mockResolvedValue({ ok: true, data: { ...off, groupId: "42" } });
  await render({ ...off, groupId: "42", enabled: true }, false);
  expect(container.querySelector<HTMLButtonElement>('[role="switch"]')!.disabled).toBe(false);
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(setVkNewsAutomation).toHaveBeenCalledWith(false, "biotech.itmo", "42");
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
});

it("guards repeated clicks while the explicit enable is pending", async () => {
  let finish!: (result: Awaited<ReturnType<typeof setVkNewsAutomation>>) => void;
  vi.mocked(setVkNewsAutomation).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await render(); await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(container.querySelector<HTMLButtonElement>('[role="switch"]')!.disabled).toBe(true);
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  await act(async () => finish({ ok: false, error: "Повторите проверку" }));
});

it("keeps a persisted manual queue visible after reloading with automation OFF", async () => {
  await render({ ...off, groupId: "42", queued: true, manualCheckPending: true });
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  expect(container.textContent).toContain("Ручная проверка сохранена в очереди");
  expect(container.textContent).toContain("при выключенном расписании");
});
