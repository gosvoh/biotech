// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DisciplinesClient from "./disciplines/page.client";
import ScientificWorksClient from "./scientific-works/page.client";
import NewsTagsClient from "./tags/page.client";
import NewsClient from "./news/page.client";
import PublicationsClient from "./publications/page.client";
import { addDiscipline, deleteDiscipline, updateDiscipline } from "./disciplines/actions";
import { addScientificWork, deleteScientificWork, updateScientificWork } from "./scientific-works/actions";
import { addNewsTags, deleteNewsTags, updateNewsTags } from "./tags/actions";

vi.mock("./disciplines/actions", () => ({ addDiscipline: vi.fn(), updateDiscipline: vi.fn(), deleteDiscipline: vi.fn() }));
vi.mock("./scientific-works/actions", () => ({ addScientificWork: vi.fn(), updateScientificWork: vi.fn(), deleteScientificWork: vi.fn() }));
vi.mock("./tags/actions", () => ({ addNewsTags: vi.fn(), updateNewsTags: vi.fn(), deleteNewsTags: vi.fn() }));
vi.mock("./news/actions", () => ({ changeVisibility: vi.fn(), deleteNews: vi.fn() }));
vi.mock("./publications/actions", () => ({ createPublication: vi.fn(), updatePublication: vi.fn(), deletePublication: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
let mobile = true;
const dates = { createdAt: new Date(0), updatedAt: new Date(0) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: !mobile, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(el => original(el));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(ui: React.ReactNode) {
  await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App>{ui}</App></ConfigProvider>));
}
async function change(input: HTMLInputElement, value: string) {
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function search(value: string) { await change(container.querySelector<HTMLInputElement>('input[aria-label^="Поиск"]')!, value); }
async function clear() { await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Очистить поиск"]')!.click()); }

it.each(["disciplines", "scientificWorks", "tags"])("searches %s independently of creation; clearing restores records without mutations", async kind => {
  const records = [{ id: "a", title: "Биология", normalizedTitle: "биология", ...dates }, { id: "b", title: "Химия", normalizedTitle: "химия", ...dates }];
  await render(kind === "disciplines" ? <DisciplinesClient disciplines={records} /> : kind === "scientificWorks" ? <ScientificWorksClient scientificWorks={records} /> : <NewsTagsClient newsTags={records} />);
  await change(container.querySelector<HTMLInputElement>('input[id="title"]')!, "Черновик");
  expect(container.querySelectorAll(".ant-list-item")).toHaveLength(2);
  await search("  БИОЛОГИЯ  ");
  expect(container.querySelectorAll(".ant-list-item")).toHaveLength(1);
  expect(container.textContent).toContain("Найдено: 1");
  expect(container.querySelector<HTMLInputElement>('input[id="title"]')!.value).toBe("Черновик");
  await search("несуществующее");
  expect(container.querySelectorAll(".ant-list-item")).toHaveLength(0);
  expect(container.textContent).toContain("Ничего не найдено");
  expect(container.textContent).toContain("Измените запрос или очистите поиск");
  expect(container.querySelectorAll('.ant-empty:not([hidden] .ant-empty)')).toHaveLength(1);
  await clear();
  expect(container.querySelectorAll(".ant-list-item")).toHaveLength(2);
  expect(container.textContent).toContain("Найдено: 2");
  for (const action of [addDiscipline, updateDiscipline, addScientificWork, updateScientificWork, addNewsTags, updateNewsTags]) expect(action).not.toHaveBeenCalled();
  const row = container.querySelector(".ant-list-item")!;
  const edit = row.querySelector<HTMLButtonElement>('button[aria-label="Редактировать: Биология"]')!;
  expect(edit.title).toBe("Редактировать");
  await act(async () => edit.click());
  await change(row.querySelector<HTMLInputElement>("input")!, "Черновик редактирования");
  const cancel = row.querySelector<HTMLButtonElement>('button[aria-label="Отменить редактирование: Биология"]')!;
  expect(cancel.title).toBe("Отмена"); await act(async () => cancel.click());
  expect(row.querySelector("input")).toBeNull(); expect(row.textContent).toContain("Биология");
  expect(document.querySelector(".ant-popconfirm")).toBeNull();
  for (const action of [deleteDiscipline, deleteScientificWork, deleteNewsTags]) expect(action).not.toHaveBeenCalled();
});

it.each([false, true])("finds news by title or tag while preserving visibility controls (mobile=%s)", async isMobile => {
  mobile = isMobile;
  await render(<NewsClient news={[
    { id: "a", title: "Открытие лаборатории", date: "2026-10-16", hidden: false, links: "", images: [], tags: [{ id: "tag", title: "Генетика", normalizedTitle: "генетика", ...dates }] },
    { id: "b", title: "Конференция", date: "2026-10-15", hidden: true, links: "", images: [], tags: [] },
  ]} />);
  for (const query of [" ЛАБОРАТОРИИ ", " ГЕНЕТИКА "]) {
    await search(query);
    expect(container.querySelectorAll(mobile ? ".ant-card" : ".ant-table-row")).toHaveLength(1);
    expect(container.textContent).toContain("Открытие лаборатории");
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(container.textContent).toContain("Найдено: 1");
  }
  await search("ничего"); expect(container.textContent).toContain("Ничего не найдено");
  expect(container.querySelectorAll('.ant-empty:not([hidden] .ant-empty)')).toHaveLength(1);
  await clear(); expect(container.querySelectorAll(mobile ? ".ant-card" : ".ant-table-row")).toHaveLength(2);
});

it.each([false, true])("finds publications by title, author and year (mobile=%s)", async isMobile => {
  mobile = isMobile;
  await render(<PublicationsClient publications={[
    { id: "a", title: "Клеточная терапия", authors: "Иванов", year: "2026", link: "https://example.test/a", ...dates },
    { id: "b", title: "Биоматериалы", authors: "Петров", year: "2025", link: "https://example.test/b", ...dates },
  ]} />);
  for (const query of [" ТЕРАПИЯ ", " ИВАНОВ ", " 2026 "]) {
    await search(query); expect(container.querySelectorAll(mobile ? ".ant-card" : ".ant-table-row")).toHaveLength(1);
    expect(container.textContent).toContain("Клеточная терапия"); expect(container.textContent).toContain("Найдено: 1");
  }
  await search("нет"); expect(container.textContent).toContain("Ничего не найдено");
  expect(container.querySelectorAll('.ant-empty:not([hidden] .ant-empty)')).toHaveLength(1);
  await clear(); expect(container.querySelectorAll(mobile ? ".ant-card" : ".ant-table-row")).toHaveLength(2);
});
