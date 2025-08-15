import { auth, signIn } from "@/auth";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";
import "@ant-design/v5-patch-for-react-19";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    await signIn(undefined, { redirectTo: "/admin" });

  return (
    <AntdRegistry>
      <ConfigProvider locale={ruRU}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
