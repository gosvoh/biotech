import { auth, signIn } from "@/auth";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import ruRU from "antd/locale/ru_RU";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== "admin") await signIn();

  return (
    <AntdRegistry>
      <ConfigProvider locale={ruRU}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
