import BiotechTextLogo from "@public/Biotech-Logotype.svg";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiVk } from "@icons-pack/react-simple-icons";
import { contacts, headerFooterLinks, links } from "@/lib/links";

export default function Footer() {
  return (
    <footer className="bg-day-secondary-violet-dark-70">
      <div className="flex flex-col justify-between md:flex-row gap-10 wrapper">
        <div className="flex flex-row md:flex-col justify-between">
          <Link href="/" className="w-fit">
            <Image
              src={BiotechTextLogo}
              alt="Biotech"
              className="w-[150px] invert"
            />
          </Link>
          <Link href={links.VK} className="w-fit">
            <SiVk className="w-10 h-10" />
          </Link>
          <Link
            className="max-md:hidden"
            target="_blank"
            href="/personal_data_policy.pdf"
          >
            Политика конфиденциальности
          </Link>
        </div>
        <div className="flex flex-col gap-6 text-base">
          {/* <Link href="/">
            <ArrowUpRight />О факультете
          </Link> */}
          {headerFooterLinks.map(({ href, text }, i) => (
            <Link key={`footer-link-${i}`} href={href} className="w-fit">
              <ArrowUpRight />
              {text}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:gap-6 text-lg">
          <div className="space-y-2">
            <h3>191002</h3>
            <p>{contacts.address}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link className="w-fit" href={`mailto:${contacts.email}`}>
              <h3>{contacts.email}</h3>
            </Link>
            <Link href={`tel:${contacts.development}`} className="w-fit">
              {contacts.development}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
