import Link from "next/link";

export default function Studies() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Studies</h1>
      <p className="text-lg">This is the studies page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/studies/groups">Groups</Link>
        <Link href="/studies/teachers">Teachers</Link>
        <Link href="/studies/impact">Impact</Link>
      </div>
    </main>
  );
}
