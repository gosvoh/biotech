import { requireAdminPage } from "@/lib/utils.server";
import { redirect } from "next/navigation";

// /admin не имеет собственного содержимого: после проверки доступа сразу
// отправляем на раздел по умолчанию. Бренд в каркасе ведёт на /admin, поэтому
// клик по нему приземляет администратора в «Новости».
export default async function Admin() {
  await requireAdminPage();
  redirect("/admin/news");
}
