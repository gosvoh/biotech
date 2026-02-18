import { generateMeta } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Администрирование",
  "Админка сайта факультета биотехнологий университета ИТМО",
  "/admin"
);

export default function Admin() {
  return (
    <main>
      <section>
        <div className="wrapper">
          <div className="flex flex-col gap-3 w-fit">
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
            <Link href="/admin/publications">
              <Button>Публикации</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
