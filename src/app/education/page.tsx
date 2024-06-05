import Link from "next/link";

export default function Education() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Education</h1>
      <p className="text-lg">This is the education page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/education/programs">Programs</Link>
        <Link href="/education/enrollment">Enrollment</Link>
        <Link href="/education/transfer">Transfer</Link>
        <Link href="/education/gqw">GQW</Link>
      </div>
    </main>
  );
}
