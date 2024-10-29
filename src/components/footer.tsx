import BiotechTextLogo from "@public/Biotech-Logotype.svg";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiVk } from "@icons-pack/react-simple-icons";
import { links } from "@/lib/links";

export default function Footer() {
  return (
    <footer className="bg-brand">
      <div className="flex flex-col justify-between md:flex-row gap-10 wrapper">
        <div className="flex flex-row md:flex-col justify-between">
          <Image
            src={BiotechTextLogo}
            alt="Biotech"
            className="w-[150px] invert"
          />
          <Link href={links.VK}>
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
          <Link href="/technologies" className="footer-link">
            <ArrowUpRight />О факультете
          </Link>
          <Link href="/consultations" className="footer-link">
            <ArrowUpRight />
            Команда
          </Link>
          <Link href="/education" className="footer-link">
            <ArrowUpRight />
            Образование
          </Link>
          <Link href="/event" className="footer-link">
            <ArrowUpRight />
            Исследования
          </Link>
          <Link href="/event" className="footer-link">
            <ArrowUpRight />
            Контакты
          </Link>
        </div>
        <div className="flex flex-col gap-4 md:gap-6 text-lg">
          <div className="space-y-2">
            <p className="max-md:font-bold text-xl md:text-3xl">191002</p>
            <p>Санкт-Петербург, ул. Ломоносова, д. 9</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              className="max-md:font-bold text-xl md:text-3xl link-hover-underline w-fit"
              href="mailto:biotech@itmo.ru"
            >
              biotech@itmo.ru
            </Link>
            <Link
              href="tel:+78124800930"
              className="link-hover-underline w-fit"
            >
              +7 (812) 480-09-30 (отдел развития)
            </Link>
            <Link href="tel:+9312789700" className="link-hover-underline w-fit">
              +7 (931) 278-97-00 (декан)
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
