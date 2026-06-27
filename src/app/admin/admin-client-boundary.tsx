"use client";

import { useEffect, useState } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";
import AdminShell from "./admin-shell";
import AdminSkeleton from "./admin-skeleton";

// Ant Design styles are CSS-in-JS injected by antd's own client runtime. Under
// Next 16 `cacheComponents` (PPR) + antd 6, `@ant-design/nextjs-registry` cannot
// extract those styles into the SSR <head> (the cssinjs StyleProvider context is
// not shared — antd ships duplicate cssinjs copies), so server-rendered antd
// markup paints unstyled for ~1s until the JS bundle hydrates and injects CSS.
//
// To avoid that flash we gate the whole antd subtree on client mount: the server
// (and the first client paint) render only the Tailwind `AdminSkeleton`, then on
// mount antd renders client-side and cssinjs injects its <style> tags *as it
// renders*, so the chrome and content appear already styled. Trade-off: the admin
// is client-rendered (no SSR HTML for it), which is fine for an internal tool.
export default function AdminClientBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot gate to defer antd to the client, intentionally post-hydration
    setMounted(true);
  }, []);

  if (!mounted) return <AdminSkeleton />;

  return (
    <AntdRegistry>
      <ConfigProvider locale={ruRU}>
        <App>
          <AdminShell>{children}</AdminShell>
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
