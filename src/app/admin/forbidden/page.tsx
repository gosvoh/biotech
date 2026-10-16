import Link from "next/link";

export default function AdminForbidden() {
  return (
    <section className="py-6">
      <h1 className="text-2xl font-bold">Недостаточно прав</h1>
      <p className="mt-3">У вас нет доступа к этому разделу. Обратитесь к администратору.</p>
      <Link href="/admin" className="mt-3 inline-block">К доступным разделам</Link>
    </section>
  );
}
