// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import DisciplinesClient from "./disciplines/page.client";
import ScientificWorksClient from "./scientific-works/page.client";
import NewsTagsClient from "./tags/page.client";
import NewsClient from "./news/page.client";
import PublicationsClient from "./publications/page.client";
import MembersClient from "./members/page.client";
import { addDiscipline, deleteDiscipline, updateDiscipline } from "./disciplines/actions";
import { addScientificWork, deleteScientificWork, updateScientificWork } from "./scientific-works/actions";
import { addNewsTags, deleteNewsTags, updateNewsTags } from "./tags/actions";
import { changeVisibility } from "./news/actions";
import { createPublication, updatePublication } from "./publications/actions";
import { addMember, duplicateMember, updateMember } from "./members/actions";

vi.mock("./disciplines/actions", () => ({ addDiscipline: vi.fn(), updateDiscipline: vi.fn(), deleteDiscipline: vi.fn() }));
vi.mock("./scientific-works/actions", () => ({ addScientificWork: vi.fn(), updateScientificWork: vi.fn(), deleteScientificWork: vi.fn() }));
vi.mock("./tags/actions", () => ({ addNewsTags: vi.fn(), updateNewsTags: vi.fn(), deleteNewsTags: vi.fn() }));
vi.mock("./news/actions", () => ({ changeVisibility: vi.fn(), deleteNews: vi.fn() }));
vi.mock("./publications/actions", () => ({ createPublication: vi.fn(), updatePublication: vi.fn(), deletePublication: vi.fn() }));
vi.mock("./members/actions", () => ({ addMember: vi.fn(), updateMember: vi.fn(), duplicateMember: vi.fn(), deleteMember: vi.fn(), reorderMembers: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Canvas/image decoding is outside submission handling; keep the actual upload/form.
vi.mock("./members/member-image-crop-modal", () => ({ MemberImageCropModal: ({ open, onApply }: { open: boolean; onApply: (file: File) => void }) => open ? <button onClick={() => onApply(new File(["photo"], "photo.webp", { type: "image/webp" }))}>Применить фото</button> : null }));

let root: Root;
let container: HTMLDivElement;
let mobile = false;
const success: ActionResult = { ok: true, data: undefined };
const dates = { createdAt: new Date(0), updatedAt: new Date(0) };
const records = [{ id: "a", title: "Биология", normalizedTitle: "биология", ...dates }];
const member = { id: "m", lastName: "Иванов", firstName: "Иван", middleName: null, image: null, departmentId: null, position: null, email: null, phone: null, sortOrder: 0, disciplines: [], scientificWorks: [], ...dates };
const publication = { id: "p", title: "Исследование", authors: "Иванов", year: "2026", link: "https://example.test/p", ...dates };
function deferred<T = void>() {
  let resolve!: (value: ActionResult<T>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ActionResult<T>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks(); mobile = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: !mobile, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(el => original(el));
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:test-photo"; } static revokeObjectURL() {} });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(ui: React.ReactNode) { await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><App>{ui}</App></ConfigProvider>)); }
async function click(element: Element | null) { expect(element).toBeTruthy(); await act(async () => (element as HTMLElement).click()); }
async function twice(element: HTMLElement) { await act(async () => { element.click(); element.click(); }); }
async function change(input: HTMLInputElement, value: string) { expect(input).toBeTruthy(); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit(form: HTMLFormElement) { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }
function button(label: string, scope: ParentNode = document) { return [...scope.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === label)!; }
function field(name: string) { return document.querySelector<HTMLInputElement>(`input[id="${name}"]`)!; }
function assertPending(button: HTMLButtonElement) { expect(button.disabled).toBe(true); expect(button.classList.contains("ant-btn-loading")).toBe(true); }
const dictionaries: {
  name: string; render: () => React.ReactNode;
  add: (title: string) => Promise<ActionResult<unknown>>;
  save: (record: typeof records[number]) => Promise<ActionResult<unknown>>;
  remove: (id: string) => Promise<ActionResult<unknown>>;
  consequence: string; retained: string;
}[] = [
  { name: "discipline", render: () => <DisciplinesClient disciplines={records} />, add: addDiscipline, save: updateDiscipline, remove: deleteDiscipline, consequence: "карточек сотрудников", retained: "Сотрудники сохранятся" },
  { name: "work", render: () => <ScientificWorksClient scientificWorks={records} />, add: addScientificWork, save: updateScientificWork, remove: deleteScientificWork, consequence: "карточек сотрудников", retained: "Сотрудники сохранятся" },
  { name: "tag", render: () => <NewsTagsClient newsTags={records} />, add: addNewsTags, save: updateNewsTags, remove: deleteNewsTags, consequence: "новостей", retained: "Новости сохранятся" },
];
it.each(dictionaries)("guards $name creation including direct form submits; errors preserve draft and allow retry", async item => {
  const first = deferred<unknown>(); vi.mocked(item.add).mockReturnValueOnce(first.promise).mockResolvedValue(item.name === "tag" ? { ok: true, data: { ...records[0], title: "Черновик", normalizedTitle: "черновик" } } : success);
  await render(item.render()); await change(field("title"), "Черновик");
  const form = container.querySelector("form")!;
  await submit(form); await submit(form);
  expect(item.add).toHaveBeenCalledExactlyOnceWith("Черновик"); assertPending(button("Добавить"));
  await act(async () => first.reject(new Error("offline")));
  expect(field("title").value).toBe("Черновик"); expect(button("Добавить").disabled).toBe(false);
  await submit(form); expect(item.add).toHaveBeenCalledTimes(2); expect(field("title").value).toBe("");
});
it.each(dictionaries)("guards $name inline save and preserves the editor on failure", async item => {
  const first = deferred<unknown>(); vi.mocked(item.save).mockReturnValueOnce(first.promise).mockResolvedValue(item.name === "tag" ? { ok: true, data: { ...records[0], title: "Обновлено", normalizedTitle: "обновлено" } } : success);
  await render(item.render()); await click(container.querySelector('[aria-label="Редактировать: Биология"]'));
  const input = container.querySelector<HTMLInputElement>('.ant-list-item input')!; await change(input, "Обновлено");
  const save = container.querySelector<HTMLButtonElement>('[aria-label="Сохранить: Биология"]')!;
  await twice(save); expect(item.save).toHaveBeenCalledOnce(); assertPending(save);
  const cancel = container.querySelector<HTMLButtonElement>('[aria-label="Отменить редактирование: Биология"]')!;
  expect(cancel.disabled).toBe(true); await click(cancel); expect(input.isConnected).toBe(true);
  await act(async () => first.resolve({ ok: false, error: "Не сохранено" }));
  expect(input.value).toBe("Обновлено"); expect(save.disabled).toBe(false);
  await click(save); expect(item.save).toHaveBeenCalledTimes(2); expect(container.querySelector('.ant-list-item input')).toBeNull();
});
it.each(dictionaries)("explains $name deletion with identity and cancels without a mutation", async item => {
  await render(item.render()); await click(container.querySelector('[aria-label="Удалить: Биология"]'));
  const confirmation = document.querySelector('.ant-popconfirm')!;
  expect(confirmation.textContent).toContain("Биология"); expect(confirmation.textContent).toContain(item.consequence); expect(confirmation.textContent).toContain(item.retained);
  await click(button("Отмена", confirmation)); expect(item.remove).not.toHaveBeenCalled();
});
it.each([false, true])("guards member copying and releases failed attempts (mobile=%s)", async isMobile => {
  mobile = isMobile; const first = deferred(); vi.mocked(duplicateMember).mockReturnValueOnce(first.promise).mockResolvedValue(success);
  await render(<MembersClient members={[member]} departments={[]} disciplines={[]} scientificWorks={[]} />);
  const copy = container.querySelector<HTMLButtonElement>('[aria-label^="Копировать:"]')!;
  await twice(copy); expect(duplicateMember).toHaveBeenCalledExactlyOnceWith("m"); assertPending(copy);
  await act(async () => first.reject(new Error("offline"))); expect(copy.disabled).toBe(false);
  await click(copy); expect(duplicateMember).toHaveBeenCalledTimes(2); expect(copy.disabled).toBe(false);
});
it.each([false, true])("guards visibility and retains saved VK manual state on failure (mobile=%s)", async isMobile => {
  mobile = isMobile; const first = deferred<Extract<Awaited<ReturnType<typeof changeVisibility>>, { ok: true }>["data"]>();
  vi.mocked(changeVisibility).mockReturnValueOnce(first.promise).mockResolvedValue({ ok: true, data: { id: "n", title: "Новость", date: "2026-10-16", hidden: true, links: "", text: "", ...dates } });
  const news = [{ id: "n", title: "Новость", date: "2026-10-16", hidden: true, links: "", images: [], tags: [], vkImport: { groupId: "1", postId: "2", syncEnabled: true, manualHidden: false, autoHiddenReason: "нет тега" } }];
  await render(<NewsClient news={news} />);
  const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(checkbox.checked).toBe(false); await twice(checkbox);
  expect(changeVisibility).toHaveBeenCalledExactlyOnceWith("n", true); expect(checkbox.disabled).toBe(true); expect(checkbox.getAttribute("aria-busy")).toBe("true");
  await act(async () => first.reject(new Error("offline"))); expect(checkbox.disabled).toBe(false); expect(checkbox.checked).toBe(false);
  await click(checkbox); expect(changeVisibility).toHaveBeenCalledTimes(2);
  await render(<NewsClient news={[{ ...news[0], vkImport: { ...news[0].vkImport, manualHidden: true } }]} />);
  expect(checkbox.checked).toBe(true); expect(checkbox.disabled).toBe(false);
});
it.each([false, true])("locks member modal direct submit and dismissal until completion (editing=%s)", async editing => {
  const mutation = editing ? updateMember : addMember;
  const first = deferred(); vi.mocked(mutation).mockReturnValueOnce(first.promise).mockResolvedValue(success);
  await render(<MembersClient members={[member]} departments={[]} disciplines={[]} scientificWorks={[]} />);
  await click(container.querySelector(editing ? '[aria-label^="Редактировать:"]' : '.ant-float-btn'));
  if (!editing) {
    await change(field("lastName"), "Новый"); await change(field("firstName"), "Сотрудник");
    const upload = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => { Object.defineProperty(upload, "files", { value: [new File(["photo"], "photo.png", { type: "image/png" })] }); upload.dispatchEvent(new Event("change", { bubbles: true })); });
    await click(button("Применить фото"));
  }
  const form = document.querySelector<HTMLFormElement>('.ant-modal form')!;
  await submit(form); await submit(form);
  expect(mutation).toHaveBeenCalledOnce(); assertPending(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')!);
  expect(document.querySelector<HTMLButtonElement>('.ant-modal-close')!.disabled).toBe(true);
  await click(document.querySelector('.ant-modal-close')); await click(document.querySelector('.ant-modal-footer .ant-btn-default'));
  expect(form.isConnected).toBe(true);
  await act(async () => first.resolve({ ok: false, error: "Не сохранено" }));
  expect(field("lastName").value).toBe(editing ? "Иванов" : "Новый");
  await submit(form); expect(mutation).toHaveBeenCalledTimes(2); expect(document.querySelector('.ant-modal')).toBeNull();
});
it.each([false, true])("locks publication modal direct submit and cancellation (editing=%s)", async editing => {
  const mutation = editing ? updatePublication : createPublication;
  const first = deferred(); vi.mocked(mutation).mockReturnValueOnce(first.promise).mockResolvedValue(success);
  await render(<PublicationsClient publications={[publication]} />);
  await click(container.querySelector(editing ? '[aria-label^="Редактировать:"]' : '.ant-float-btn'));
  if (!editing) {
    await change(field("authors"), "Автор"); await change(field("title"), "Новая работа"); await change(field("link"), "https://example.test/new");
    await click(field("year"));
    await click(document.querySelector('.ant-picker-cell-in-view .ant-picker-cell-inner'));
  }
  const form = document.querySelector<HTMLFormElement>('.ant-modal form')!;
  await submit(form); await submit(form);
  expect(mutation).toHaveBeenCalledOnce(); assertPending(button("Сохранить"));
  await click(button("Отмена")); await click(document.querySelector('.ant-modal-close'));
  expect(form.isConnected).toBe(true);
  await act(async () => first.reject(new Error("offline")));
  expect(field("title").value).toBe(editing ? "Исследование" : "Новая работа");
  await submit(form); expect(mutation).toHaveBeenCalledTimes(2); expect(document.querySelector('.ant-modal')).toBeNull();
});
