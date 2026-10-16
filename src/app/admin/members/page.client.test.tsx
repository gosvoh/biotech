// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MembersClient from "./page.client";
import { addMember, deleteMember, duplicateMember, reorderMembers, updateMember } from "./actions";
import type { MemberWithRelations } from "./types";

// Server actions require authentication and a database; keep the client UI real.
vi.mock("./actions", () => ({
  addMember: vi.fn(async () => ({ ok: true })),
  updateMember: vi.fn(async () => ({ ok: true })),
  deleteMember: vi.fn(),
  duplicateMember: vi.fn(),
  reorderMembers: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const dates = { createdAt: new Date(0), updatedAt: new Date(0) };
const department = { id: "department-a", name: "Отдел А", ...dates };
const discipline = { id: "discipline-a", title: "Дисциплина А", ...dates };
const work = { id: "work-a", title: "Работа А", ...dates };
const first: MemberWithRelations = {
  id: "member-a",
  image: null,
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  position: "Исследователь",
  email: "ivan@example.com",
  phone: "+79991112233",
  departmentId: department.id,
  sortOrder: 0,
  disciplines: [discipline],
  scientificWorks: [work],
  ...dates,
};
const second: MemberWithRelations = {
  id: "member-b",
  image: null,
  lastName: "Петров",
  firstName: "Пётр",
  middleName: null,
  position: null,
  email: null,
  phone: null,
  departmentId: null,
  sortOrder: 1,
  disciplines: [],
  scientificWorks: [],
  ...dates,
};

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // jsdom has no layout or media queries. Render the real mobile member cards.
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  // Ant Design measures scrollbars with a pseudo-element unsupported by jsdom.
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    getComputedStyle(element),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <App>
          <MembersClient
            members={[first, second]}
            departments={[department]}
            disciplines={[discipline]}
            scientificWorks={[work]}
          />
        </App>
      </ConfigProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
}

async function edit(lastName: string) {
  const card = [...container.querySelectorAll(".ant-card")].find((card) =>
    card.textContent?.includes(lastName),
  );
  await click(card?.querySelector('[aria-label="edit"]')?.closest("button"));
}

async function cancel() {
  await click(document.querySelector(".ant-modal-close"));
}

function field(name: string) {
  const input = document.querySelector<HTMLInputElement>(`input[id="${name}"]`);
  expect(input).not.toBeNull();
  return input!;
}

async function changeLastName(value: string) {
  await act(async () => {
    const input = field("lastName");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!
      .set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(field("lastName").value).toBe(value);
}

function expectEmptyOptionalFields() {
  for (const name of ["middleName", "position", "email", "phone"])
    expect(field(name).value).toBe("");
  expect(document.querySelectorAll(".ant-modal .ant-select-selection-item")).toHaveLength(0);
  expect(document.querySelector(".ant-modal")!.textContent).not.toContain("Отдел А");
}

describe("member editing sessions", () => {
  it("searches full names, department, position and contacts, retaining the full ordering form", async () => {
    const search = () => container.querySelector<HTMLInputElement>('input[aria-label^="Поиск"]')!;
    async function query(value: string) {
      expect(search()).toBeTruthy();
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search(), value);
        search().dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    for (const value of [" ИВАНОВ ИВАН ", " ИВАНОВИЧ ", " ОТДЕЛ А ", " ИССЛЕДОВАТЕЛЬ ", " IVAN@EXAMPLE.COM ", " 1112233 "]) {
      await query(value);
      expect(container.querySelectorAll(".ant-card")).toHaveLength(1);
      expect(container.textContent).toContain("Иванов");
      expect(container.textContent).toContain("Найдено: 1");
    }
    await click([...container.querySelectorAll("button")].find(button => button.textContent === "Изменить порядок"));
    expect(document.querySelector(".ant-modal")!.textContent).toContain("Иванов");
    expect(document.querySelector(".ant-modal")!.textContent).toContain("Петров");
    await cancel();
    await query("ничего");
    expect(container.textContent).toContain("Ничего не найдено");
    await click(container.querySelector('button[aria-label="Очистить поиск"]'));
    expect(container.querySelectorAll(".ant-card")).toHaveLength(2);
    for (const action of [addMember, updateMember, deleteMember, duplicateMember, reorderMembers]) expect(action).not.toHaveBeenCalled();
    await edit("Иванов"); await changeLastName("Несохранённая фамилия"); await cancel();
    await query(" ПЕТРОВ "); await edit("Петров");
    expect(field("lastName").value).toBe("Петров"); expectEmptyOptionalFields();
  });
  it("opens the second member with their own data after cancelling the first", async () => {
    await edit("Иванов");
    expect(field("lastName").value).toBe("Иванов");
    expect(field("phone").value).toBe("+79991112233");
    const modal = document.querySelector(".ant-modal")!;
    expect(modal.textContent).toContain("Отдел А");
    expect(modal.textContent).toContain("Дисциплина А");
    expect(modal.textContent).toContain("Работа А");
    await changeLastName("Несохранённая фамилия");
    await cancel();
    await edit("Петров");
    expect(field("lastName").value).toBe("Петров");
    expect(field("firstName").value).toBe("Пётр");
    expectEmptyOptionalFields();
  });

  it("discards unsaved changes when reopening the same member", async () => {
    await edit("Иванов");
    await changeLastName("Несохранённая фамилия");
    await cancel();
    await edit("Иванов");
    expect(field("lastName").value).toBe("Иванов");
    expect(field("phone").value).toBe("+79991112233");
  });

  it("opens an empty creation form after cancelling member editing", async () => {
    await edit("Иванов");
    await cancel();
    await click(container.querySelector(".ant-float-btn"));
    expect(field("lastName").value).toBe("");
    expect(field("firstName").value).toBe("");
    expectEmptyOptionalFields();
  });

  it("discards an unsaved new member when reopening creation", async () => {
    await click(container.querySelector(".ant-float-btn"));
    await changeLastName("Новый сотрудник");
    await cancel();
    await click(container.querySelector(".ant-float-btn"));
    expect(field("lastName").value).toBe("");
  });

  it("submits only the second member's values after switching members", async () => {
    await edit("Иванов");
    await cancel();
    await edit("Петров");
    await click(document.querySelector(".ant-modal-footer .ant-btn-primary"));
    await vi.waitFor(() => expect(updateMember).toHaveBeenCalledOnce());
    const data = vi.mocked(updateMember).mock.calls[0][0];
    expect(data.get("id")).toBe("member-b");
    expect(data.get("lastName")).toBe("Петров");
    expect(data.get("firstName")).toBe("Пётр");
    expect(data.get("phone")).toBeNull();
    expect(data.get("departmentId")).toBeNull();
    expect(data.get("disciplines")).toBe("");
    expect(data.get("scientificWorks")).toBe("");
  });
});
