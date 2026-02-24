import Link from "next/link";

export default async function NotFound() {
  return (
    <main>
      <section>
        <div className="wrapper space-y-6">
          <h1>Страница не найдена</h1>
          <p>Проверьте адрес или вернитесь на главную страницу.</p>
          <Link href="/" className="underline">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
