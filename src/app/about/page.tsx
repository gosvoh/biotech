import Link from "next/link";

export default function About() {
  return (
    <main>
      <h1>О факультете</h1>
      <p className="text-lg">This is the about page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/about/mission">Миссия, история и традиции</Link>
        <Link href="/about/dean-word">Слово декана</Link>
        <Link href="/about/other">Other</Link>
        <Link href="/about/map">Map</Link>
      </div>
    </main>
  );
}
