import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";

// Authorization lives in each page via `requireAdminPage()`, not here: in the
// App Router a layout and its pages render in parallel, so a layout-only guard
// cannot stop a page from querying the database. The layout only sets up the
// Ant Design runtime (registry, locale, message/notification context).
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={ruRU}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
