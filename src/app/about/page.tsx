import Link from "next/link";

export default function About() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">About</h1>
      <p className="text-lg">This is the about page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/about/mission">Mission</Link>
        <Link href="/about/dean-word">Dean's Word</Link>
        <Link href="/about/other">Other</Link>
        <Link href="/about/map">Map</Link>
      </div>
    </main>
  );
}
