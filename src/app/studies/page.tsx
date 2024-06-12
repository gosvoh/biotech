import Link from "next/link";

export default function Studies() {
  return (
    <main>
      <h1>Studies</h1>
      <p className="text-lg">This is the studies page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/studies/groups">Groups</Link>
        <Link href="/studies/teachers">Teachers</Link>
        <Link href="/studies/impact">Impact</Link>
      </div>
    </main>
  );
}
