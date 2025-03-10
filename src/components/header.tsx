"use client";

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
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { headerFooterLinks } from "@/lib/links";

const MobileMenu = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button size="icon" variant="ghost" className="md:hidden">
        <MenuIcon className="!size-6 text-white" />
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
          <nav className="flex flex-col gap-8 items-start text-lg">
            {headerFooterLinks.map(({ href, text }, i) => (
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
    {headerFooterLinks.map(({ href, text }, i) => (
      <Link key={`link-${i}`} href={href}>
        {text}
      </Link>
    ))}
  </nav>
);

export default function Header() {
  return (
    <header className="md:bg-card">
      <div className="flex flex-row justify-between items-center gap-4 wrapper">
        <Link href="/">
          <Image
            src={BiotechTextLogo}
            alt="Biotech"
            className="h-11 md:h-20 w-auto max-md:invert"
          />
        </Link>
        <MobileMenu />
        <DesktopMenu />
      </div>
    </header>
  );
}
