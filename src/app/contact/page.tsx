import Link from "next/link";

export default function Contact() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Contact</h1>
      <p className="text-lg">This is the contact page.</p>
      <div className="flex flex-row space-x-4 font-bold">
        <Link href="/contact/contact-us">Contact Us</Link>
        <Link href="/contact/ask-dean">Ask Dean</Link>
      </div>
    </main>
  );
}
