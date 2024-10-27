import Image from "next/image";
import BiotechTextLogo from "@public/Biotech-Logotype.svg";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { MenuIcon, X } from "lucide-react";
import Link from "next/link";
import React from "react";

const links: {
  href: React.ComponentPropsWithoutRef<typeof Link>["href"];
  text: string;
}[] = [
  { href: "/#team", text: "Команда" },
  { href: "/#education", text: "Обучение" },
  { href: "/#research", text: "Исследования" },
  { href: "/contacts", text: "Контакты" },
];

const MobileMenu = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button size="icon" variant="ghost" className="md:hidden">
        <MenuIcon className="w-10 h-10 text-white" />
      </Button>
    </SheetTrigger>
    <SheetContent side={"top"} className="h-full">
      <SheetHeader className="flex flex-col gap-20">
        <SheetTitle className="flex flex-row justify-between items-center">
          <Link href="/">
            <Image src={BiotechTextLogo} alt="Biotech" className="w-32" />
          </Link>
        </SheetTitle>
        <SheetDescription asChild>
          <nav className="flex flex-col gap-8 items-start text-xl">
            {links.map(({ href, text }, i) => (
              <SheetClose asChild key={`link-${i}`}>
                <Link className="text-left" href={href}>
                  {text}
                </Link>
              </SheetClose>
            ))}
          </nav>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
);

const DesktopMenu = () => (
  <nav className="hidden md:inline-flex gap-6 text-left text-lg">
    {links.map(({ href, text }, i) => (
      <Link key={`link-${i}`} href={href} className="link-hover-underline">
        {text}
      </Link>
    ))}
  </nav>
);

export default function Header() {
  return (
    <header className="sticky top-0 z-10 md:bg-card">
      <div className="flex flex-row justify-between items-center gap-4 wrapper">
        <Link href="/">
          <Image
            src={BiotechTextLogo}
            alt="Biotech"
            className="w-32 max-md:invert"
          />
        </Link>
        <MobileMenu />
        <DesktopMenu />
      </div>
    </header>
  );
}
