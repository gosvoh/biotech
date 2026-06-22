"use client";

import { useEffect, useState } from "react";
import { Breadcrumb, Button, Drawer, Layout, Menu } from "antd";
import { LogoutOutlined, MenuOutlined } from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  adminMenuItems,
  getBreadcrumbItems,
  getSelectedKey,
} from "./admin-nav";

const { Sider, Header, Content } = Layout;

const COLLAPSE_KEY = "admin-sider-collapsed";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();

  // Start expanded so the first client render matches the server (which has no
  // localStorage); read the persisted value only after mount to avoid a
  // hydration mismatch on the Sider's width and brand label.
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync from localStorage on mount, intentionally post-hydration
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  const handleCollapse = (value: boolean) => {
    setCollapsed(value);
    window.localStorage.setItem(COLLAPSE_KEY, String(value));
  };

  const selectedKey = getSelectedKey(pathname);
  const selectedKeys = selectedKey ? [selectedKey] : [];

  const navigate = (key: string) => {
    router.push(key);
    setDrawerOpen(false);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        className="!hidden lg:!block"
        theme="dark"
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={handleCollapse}
      >
        <Link
          href="/admin"
          className="flex h-12 items-center justify-center px-2 font-bold text-white"
        >
          {collapsed ? "Б" : "Биотех · Админка"}
        </Link>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={adminMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          className="flex items-center justify-between gap-2 px-4"
          style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}
        >
          <div className="flex items-center gap-2">
            <Button
              className="lg:!hidden"
              type="text"
              aria-label="Меню"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
            <Link
              href="/admin"
              className="hidden font-bold sm:block lg:hidden"
            >
              Биотех · Админка
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">На сайт →</Link>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => signOut({ redirectTo: "/" })}
            >
              Выход
            </Button>
          </div>
        </Header>

        <Content className="px-4 pb-6 sm:px-6">
          <Breadcrumb
            className="py-3"
            items={getBreadcrumbItems(pathname)}
          />
          {children}
        </Content>
      </Layout>

      <Drawer
        placement="left"
        size={250}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={adminMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Drawer>
    </Layout>
  );
}
