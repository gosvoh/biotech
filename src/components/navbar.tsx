import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Dropdown } from "antd";

const links: {
  name: string;
  path: React.ComponentProps<typeof Link>["href"];
}[] = [
  { name: "Главная", path: "/" },
  { name: "О факультете", path: "/about" },
  { name: "Команда", path: "/team" },
  { name: "Образование", path: "/education" },
  { name: "Исследования", path: "/studies" },
  { name: "Контакты", path: "/contact" },
];

export function DesktopNavbar({
  className,
}: {
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
}) {
  return (
    <nav
      className={cn(
        "flex items-center justify-between py-8 px-4 lg:px-8 bg-gray-800 text-white",
        className
      )}
    >
      <div className="flex items-center space-x-4">
        {links.map((link, i) => (
          <Link
            href={link.path}
            className="text-lg lg:text-xl xl:text-2xl font-bold"
            key={`navbar-${i}`}
          >
            {link.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function MobileNavbar({
  className,
}: {
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
}) {
  return (
    <Dropdown
      trigger={["click"]}
      className={className}
      menu={{
        items: links.map((link, i) => ({
          label: <Link href={link.path}>{link.name}</Link>,
          key: `navbar-${i}`,
        })),
      }}
    >
      <Button variant="outline" size="icon" className={cn("navbar", className)}>
        <Menu className="h-4 w-4" />
      </Button>
    </Dropdown>
  );
}
