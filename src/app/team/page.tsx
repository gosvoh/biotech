import Link from "next/link";

export default function Team() {
  return (
    <main>
      <h1>Команда</h1>
      <p className="text-lg">This is the team page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/team/development">Отдел развития</Link>
        <Link href="/team/teachers">
          Преподаватели и руководители научных групп
        </Link>
      </div>
    </main>
  );
}
