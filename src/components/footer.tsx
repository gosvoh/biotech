import BiotechTextLogo from "@public/Biotech-Logotype.svg";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiVk } from "@icons-pack/react-simple-icons";
import { contacts, headerFooterLinks, links } from "@/lib/links";

export default function Footer() {
  return (
    <footer className="bg-brand">
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
            className="link-hover-underline max-md:hidden"
            target="_blank"
            href="/personal_data_policy.pdf"
          >
            Политика конфиденциальности
          </Link>
        </div>
        <div className="flex flex-col gap-6 text-base">
          <Link href="/" className="footer-link">
            <ArrowUpRight />О факультете
          </Link>
          {headerFooterLinks.map(({ href, text }, i) => (
            <Link
              key={`footer-link-${i}`}
              href={href}
              className="footer-link w-fit"
            >
              <ArrowUpRight />
              {text}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:gap-6 text-lg">
          <div className="space-y-2">
            <p className="max-md:font-bold text-xl lg:text-2xl xl:text-3xl">
              191002
            </p>
            <p>{contacts.address}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              className="max-md:font-bold text-xl lg:text-2xl xl:text-3xl footer-link w-fit"
              href={`mailto:${contacts.email}`}
            >
              {contacts.email}
            </Link>
            <Link
              href={`tel:${contacts.development}`}
              className="footer-link w-fit"
            >
              {`${contacts.development} (отдел развития)`}
            </Link>
            <Link href={`tel:${contacts.dean}`} className="footer-link w-fit">
              {`${contacts.dean} (декан)`}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
