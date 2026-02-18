import { auth, signIn } from "@/auth";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";
import { Suspense } from "react";

async function AdminContent({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    await signIn(undefined, { redirectTo: "/admin" });

  return (
    <ConfigProvider locale={ruRU}>
      <App>{children}</App>
    </ConfigProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AntdRegistry>
        <AdminContent>{children}</AdminContent>
      </AntdRegistry>
    </Suspense>
  );
}
