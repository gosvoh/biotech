// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewsTagsClient from "./page.client";
import { addNewsTags, updateNewsTags } from "./actions";
import type { NewsTags } from "@/lib/db/client";

vi.mock("./actions", () => ({
  addNewsTags: vi.fn(async () => ({ ok: true })),
  updateNewsTags: vi.fn(async () => ({ ok: true })),
  deleteNewsTags: vi.fn(async () => ({ ok: true })),
}));

const dates = { createdAt: new Date(0), updatedAt: new Date(0), normalizedTitle: null };
const tags: NewsTags[] = [
  { id: "a", title: "Наука", ...dates },
  { id: "b", title: "наука", ...dates },
  { id: "c", title: "Научные исследования", ...dates },
];
let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({
    media, matches: false, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => computedStyle(element));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ConfigProvider theme={{ token: { motion: false } }}><App><NewsTagsClient newsTags={tags} /></App></ConfigProvider>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("news tag editor", () => {
  it("marks legacy invalid names and duplicates without changing their display", () => {
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(3);
    expect(container.textContent).toContain("Требуется исправление");
    expect(container.textContent).toContain("Научные исследования");
    expect(container.textContent).toContain("Наука");
    expect(container.textContent).toContain("наука");
  });
  it("normalizes a leading hash before submitting a valid name", async () => {
    const input = container.querySelector<HTMLInputElement>('input[id="title"]')!;
    await change(input, "#Образование");
    expect(input.value).toBe("Образование");
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(addNewsTags).toHaveBeenCalledWith("Образование");
  });
  it.each(["Новое образование", "НАУКА", "##Образование"])("explains invalid or conflicting creation %j without submitting", async (title) => {
    await change(container.querySelector<HTMLInputElement>('input[id="title"]')!, title);
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(addNewsTags).not.toHaveBeenCalled();
    expect(container.querySelector('.ant-form-item-explain-error')).not.toBeNull();
  });
  it("blocks an invalid rename and allows correcting the legacy title", async () => {
    const row = [...container.querySelectorAll('.ant-list-item')].find((item) => item.textContent?.includes("Научные исследования"))!;
    await act(async () => { (row.querySelector('[aria-label="edit"]')!.closest("button") as HTMLButtonElement).click(); });
    const input = row.querySelector<HTMLInputElement>("input")!;
    await change(input, "Наука-наука");
    const save = row.querySelector('[aria-label="save"]')!.closest("button") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(row.textContent).toContain("Пробелы и дефисы запрещены");
    expect(updateNewsTags).not.toHaveBeenCalled();
    await change(input, "#НаучныеИсследования");
    expect(input.value).toBe("НаучныеИсследования");
    expect(save.disabled).toBe(false);
    await act(async () => { save.click(); });
    expect(updateNewsTags).toHaveBeenCalledWith(expect.objectContaining({ id: "c", title: "НаучныеИсследования" }));
  });
  it("rejects a pasted double hash when renaming", async () => {
    const row = [...container.querySelectorAll('.ant-list-item')].find((item) => item.textContent?.includes("Научные исследования"))!;
    await act(async () => { (row.querySelector('[aria-label="edit"]')!.closest("button") as HTMLButtonElement).click(); });
    await change(row.querySelector<HTMLInputElement>("input")!, "##Образование");
    const save = row.querySelector('[aria-label="save"]')!.closest("button") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(updateNewsTags).not.toHaveBeenCalled();
  });
});
