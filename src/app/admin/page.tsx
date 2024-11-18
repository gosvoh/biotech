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
            <Link href="/admin/disciplines">
              <Button>Дисциплины</Button>
            </Link>
            <Link href="/admin/scientific-works">
              <Button>Научные работы</Button>
            </Link>
          </Space>
        </div>
      </section>
    </main>
  );
}
