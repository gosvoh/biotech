import type Link from "next/link";

export const links = { VK: "https://vk.com/biotech.itmo" } as const;

export const headerFooterLinks: {
  href: React.ComponentPropsWithoutRef<typeof Link>["href"];
  text: string;
}[] = [
  { href: "/team", text: "Команда" },
  { href: "/education", text: "Образование" },
  { href: "/#research", text: "Исследования" },
  { href: "/#contacts", text: "Контакты" },
] as const;
