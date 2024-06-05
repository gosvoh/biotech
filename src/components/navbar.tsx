import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between p-8 bg-gray-800 text-white">
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-2xl font-bold">
          Home
        </Link>
        <Link href="/team" className="text-2xl font-bold">
          Team
        </Link>
        <Link href="/education" className="text-2xl font-bold">
          Education
        </Link>
        <Link href="/studies" className="text-2xl font-bold">
          Studies
        </Link>
        <Link href="/about" className="text-2xl font-bold">
          About
        </Link>
      </div>
    </nav>
  );
}
