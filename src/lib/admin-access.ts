export type AdminSection = "members" | "disciplines" | "scientific-works" | "news" | "publications";

export type AdminAccess = {
  userId: string;
  role: "admin" | "user";
  status: "pending" | "active" | "blocked";
  sections: AdminSection[];
};

export const ADMIN_SECTIONS: readonly { code: AdminSection; label: string; path: string }[] = [
  { code: "members", label: "Команда", path: "/admin/members" },
  { code: "disciplines", label: "Дисциплины", path: "/admin/disciplines" },
  { code: "scientific-works", label: "Научные работы", path: "/admin/scientific-works" },
  { code: "news", label: "Новости и теги", path: "/admin/news" },
  { code: "publications", label: "Публикации в журналах", path: "/admin/publications" },
];

export const ADMIN_ACCESS_BUNDLES = {
  news: { label: "Новости и теги", sections: ["news"] },
  team: { label: "Команда", sections: ["members", "disciplines", "scientific-works"] },
} as const satisfies Record<string, { label: string; sections: readonly AdminSection[] }>;

export function isFullAdmin(access: AdminAccess): boolean {
  return access.status === "active" && access.role === "admin";
}

export function canManageSection(access: AdminAccess, section: string): boolean {
  if (!ADMIN_SECTIONS.some((entry) => entry.code === section)) return false;
  if (access.status !== "active") return false;
  return isFullAdmin(access) || (access.role === "user" && access.sections.includes(section as AdminSection));
}

export function getAdminSectionForPath(pathname: string): AdminSection | null {
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  if (matches("/admin/tags")) return "news";
  return ADMIN_SECTIONS.find((entry) => matches(entry.path))?.code ?? null;
}

export function getAdminLanding(access: AdminAccess): string {
  if (isFullAdmin(access)) return "/admin/news";
  return ADMIN_SECTIONS.find((entry) => canManageSection(access, entry.code))?.path ?? "/admin";
}
