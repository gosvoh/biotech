import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";
import { Suspense } from "react";

// Authorization lives in each page via `requireAdminPage()`, not here: in the
// App Router a layout and its pages render in parallel, so a layout-only guard
// cannot stop a page from querying the database. The layout only sets up the
// Ant Design runtime (registry, locale, message/notification context).
//
// The Suspense boundary is required because Ant Design's client runtime calls
// `Math.random()` (style cache keys); Next.js needs a Suspense boundary above
// such a Client Component to prerender it.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AntdRegistry>
        <ConfigProvider locale={ruRU}>
          <App>{children}</App>
        </ConfigProvider>
      </AntdRegistry>
    </Suspense>
  );
}
