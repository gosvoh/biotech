// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfigProvider, type TableProps } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResponsiveTable } from "./responsive-table";
type Row = { id: number; name: string };
const records = Array.from({ length: 21 }, (_, id) => ({ id, name: `Record ${id + 1}` }));
let root: Root;
let container: HTMLDivElement;
let mobile = false;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: !mobile, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const original = window.getComputedStyle.bind(window); vi.spyOn(window, "getComputedStyle").mockImplementation(el => original(el));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(data = records, resetKey = "", props: TableProps<Row> = {}) {
  await act(async () => root.render(<ConfigProvider theme={{ token: { motion: false } }}><ResponsiveTable<Row>
    dataSource={data} rowKey="id" resetKey={resetKey} mobilePageSize={10} pagination={{ pageSize: 10, showSizeChanger: false }}
    columns={[{ title: "Name", dataIndex: "name", sorter: (a, b) => a.name.localeCompare(b.name) }]}
    renderCard={record => <article>{record.name}</article>} {...props}
  /></ConfigProvider>));
}
async function page(number: number) { await act(async () => container.querySelector<HTMLElement>(`.ant-pagination-item-${number}`)!.click()); }
function rows() { return [...container.querySelectorAll(mobile ? "article" : ".ant-table-tbody .ant-table-row")].map(el => el.textContent); }
it.each([false, true])("resets late page to first results when query changes (mobile=%s)", async isMobile => {
  mobile = isMobile; await render(); await page(3); expect(rows()).toEqual(["Record 21"]);
  await render(records.slice(0, 15), "search"); expect(rows()[0]).toBe("Record 1"); expect(rows()).toHaveLength(10);
});
it.each([false, true])("clamps deletion of the last row to the preceding page (mobile=%s)", async isMobile => {
  mobile = isMobile; await render(); await page(3); expect(rows()).toEqual(["Record 21"]);
  await render(records.slice(0, 20)); expect(rows()[0]).toBe("Record 11"); expect(rows()).toHaveLength(10);
});
it("retains desktop controlled pagination, page callbacks and sorting", async () => {
  mobile = false; const onChange = vi.fn(); const onPageChange = vi.fn();
  await render(records, "", { pagination: { current: 2, pageSize: 10, onChange: onPageChange }, onChange });
  expect(rows()[0]).toBe("Record 11"); await page(3);
  expect(onPageChange).toHaveBeenCalledWith(3, 10); expect(onChange.mock.calls[0][0].current).toBe(3);
  await act(async () => container.querySelector<HTMLElement>(".ant-table-column-sorters")!.click());
  expect(onChange.mock.calls.at(-1)?.[2].order).toBe("ascend");
});
it.each([false, true])("notifies the controlled owner to reset query results to page one (mobile=%s)", async isMobile => {
  mobile = isMobile;
  const onPageChange = vi.fn();
  const onTableChange = vi.fn();
  function ControlledList() {
    const [current, setCurrent] = useState(2);
    const [query, setQuery] = useState("");
    return <ConfigProvider theme={{ token: { motion: false } }}>
      <button onClick={() => setQuery("filtered")}>Search</button>
      <output>{current}</output>
      <ResponsiveTable<Row> rowKey="id" dataSource={query ? records.slice(0, 15) : records} resetKey={query}
        mobilePageSize={10} pagination={{ current, pageSize: 10, onChange: (next, size) => { onPageChange(next, size); setCurrent(next); } }}
        columns={[{ title: "Name", dataIndex: "name" }]} renderCard={record => <article>{record.name}</article>}
        onChange={onTableChange} />
    </ConfigProvider>;
  }
  await act(async () => root.render(<ControlledList />));
  expect(rows()[0]).toBe("Record 11");
  expect(onPageChange).not.toHaveBeenCalled();
  await page(1); expect(rows()[0]).toBe("Record 1");
  await page(2); expect(rows()[0]).toBe("Record 11");
  onPageChange.mockClear(); onTableChange.mockClear();
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
  expect(rows()[0]).toBe("Record 1");
  expect(rows()).toHaveLength(10);
  expect(container.querySelector("output")!.textContent).toBe("1");
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith(1, 10);
  expect(onTableChange).not.toHaveBeenCalled();
});
it.each([false, true])("keeps the controlled owner on the clamped page after records grow again (mobile=%s)", async isMobile => {
  mobile = isMobile;
  const onPageChange = vi.fn();
  const onTableChange = vi.fn();
  function ControlledList() {
    const [current, setCurrent] = useState(3);
    const [count, setCount] = useState(21);
    return <ConfigProvider theme={{ token: { motion: false } }}>
      <button onClick={() => setCount(5)}>Delete</button><button onClick={() => setCount(21)}>Add</button>
      <output>{current}</output>
      <ResponsiveTable<Row> rowKey="id" dataSource={records.slice(0, count)} resetKey="stable" mobilePageSize={10}
        pagination={{ current, pageSize: 10, onChange: (next, size) => { onPageChange(next, size); setCurrent(next); } }}
        columns={[{ title: "Name", dataIndex: "name" }]} renderCard={record => <article>{record.name}</article>}
        onChange={onTableChange} />
    </ConfigProvider>;
  }
  await act(async () => root.render(<ControlledList />));
  expect(rows()).toEqual(["Record 21"]);
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Delete")!.click());
  expect(rows()[0]).toBe("Record 1"); expect(rows()).toHaveLength(5);
  expect(container.querySelector("output")!.textContent).toBe("1");
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith(1, 10);
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Add")!.click());
  expect(rows()[0]).toBe("Record 1"); expect(rows()).toHaveLength(10);
  expect(container.querySelector("output")!.textContent).toBe("1");
  expect(onPageChange).toHaveBeenCalledOnce(); expect(onTableChange).not.toHaveBeenCalled();
});
