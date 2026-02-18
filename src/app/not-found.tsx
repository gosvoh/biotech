import Link from "next/link";
import RevealSection from "@/components/reveal-section";

export default async function NotFound() {

  return (
    <main>
      <RevealSection>
        <div className="wrapper space-y-6">
          <h1>Страница не найдена</h1>
          <p>Проверьте адрес или вернитесь на главную страницу.</p>
          <Link href="/" className="underline">
            На главную
          </Link>
        </div>
      </RevealSection>
    </main>
  );
}
