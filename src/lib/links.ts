import type Link from "next/link";

export const links = { VK: "https://vk.com/biotech.itmo" } as const;

export const headerFooterLinks: {
  href: React.ComponentPropsWithoutRef<typeof Link>["href"];
  text: string;
}[] = [
  { href: "/team", text: "Команда" },
  { href: "/education", text: "Образование" },
  { href: "/research", text: "Исследования" },
  { href: "/contacts", text: "Контакты" },
] as const;

export const contacts = {
  email: "biotech@itmo.ru",
  development: "+7 (812) 480-09-30",
  dean: "+7 (931) 278-97-00",
  address: "Санкт-Петербург, ул. Ломоносова, д. 9",
} as const;
