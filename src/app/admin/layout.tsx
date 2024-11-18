import { auth, signIn } from "@/auth";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // if (!session || session.user.role !== "admin") await signIn();

  return (
    <AntdRegistry>
      <ConfigProvider>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
