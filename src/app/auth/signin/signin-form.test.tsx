// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SigninForm from "./signin-form";
vi.mock("./actions", () => ({ requestSignIn: async () => ({ submitted: true }) }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it("offers a labeled email form and shows a neutral result after submission", async () => {
  await act(async () => root.render(<SigninForm />));
  const input = container.querySelector<HTMLInputElement>('input[name="email"]')!;
  expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toContain("Электронная почта");
  input.value = "person@example.test";
  await act(async () => container.querySelector<HTMLFormElement>("form")!.requestSubmit());
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Если для этого адреса открыт доступ");
  expect(container.textContent).not.toContain("person@example.test");
});
it("shows the same acknowledgement on the receipt and a safe message on link errors", async () => {
  await act(async () => root.render(<SigninForm submitted />));
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Если для этого адреса открыт доступ");
  await act(async () => root.render(<SigninForm key="error" failed />));
  expect(container.textContent).toContain("Запросите новую ссылку");
  expect(container.querySelector('input[type="email"]')).not.toBeNull();
});
