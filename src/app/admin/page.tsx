import { Button, Space } from "antd";
import Link from "next/link";

export default function Admin() {
  return (
    <main>
      <section>
        <div className="wrapper">
          <Space direction="vertical">
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
            <Link href="/admin/news">
              <Button>Новости</Button>
            </Link>
            <Link href="/admin/tags">
              <Button>Теги новостей</Button>
            </Link>
          </Space>
        </div>
      </section>
    </main>
  );
}
