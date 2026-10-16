import { requireAdminAccessPage } from "@/lib/admin-access.server";
import { getAdminLanding } from "@/lib/admin-access";
import { redirect } from "next/navigation";

export default async function Admin() {
  const access = await requireAdminAccessPage();
  const landing = getAdminLanding(access);
  if (landing !== "/admin") redirect(landing);
  return (
    <section className="py-6">
      <h1 className="text-2xl font-bold">Доступ к администрированию</h1>
      <p className="mt-3">Вам пока не назначены разделы. Обратитесь к администратору, чтобы получить доступ.</p>
    </section>
  );
}
