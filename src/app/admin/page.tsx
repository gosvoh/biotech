import { Button, Space } from "antd";
import Link from "next/link";

export default function Admin() {
  return (
    <main>
      <section>
        <div className="wrapper">
          <Space>
            <Link href="/admin/users">
              <Button>Пользователи</Button>
            </Link>
            <Link href="/admin/members">
              <Button>Команда</Button>
            </Link>
          </Space>
        </div>
      </section>
    </main>
  );
}
