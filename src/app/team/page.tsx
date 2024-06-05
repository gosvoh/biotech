import Link from "next/link";

export default function Team() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Team</h1>
      <p className="text-lg">This is the team page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/team/development">Development</Link>
        <Link href="/team/teachers">Teachers</Link>
      </div>
    </main>
  );
}
