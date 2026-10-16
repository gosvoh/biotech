"use client";

import Link from "next/link";
import { canManageSection, getAdminSectionForPath, isFullAdmin, type AdminAccess } from "@/lib/admin-access";
import type { BreadcrumbProps, MenuProps } from "antd";
import {
  BookOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ReadOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

export type AdminNavEntry = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

export const adminNav: AdminNavEntry[] = [
  { key: "/admin/users", label: "Пользователи", icon: <UserOutlined /> },
  { key: "/admin/members", label: "Команда", icon: <TeamOutlined /> },
  { key: "/admin/disciplines", label: "Дисциплины", icon: <ReadOutlined /> },
  {
    key: "/admin/scientific-works",
    label: "Научные работы",
    icon: <ExperimentOutlined />,
  },
  { key: "/admin/news", label: "Новости", icon: <FileTextOutlined /> },
  { key: "/admin/tags", label: "Теги новостей", icon: <TagsOutlined /> },
  {
    key: "/admin/publications",
    label: "Публикации в журналах",
    icon: <BookOutlined />,
  },
];

export function getAdminMenuItems(access: AdminAccess | null): MenuProps["items"] {
  if (!access) return [];
  return adminNav.filter(entry => {
    if (entry.key === "/admin/users") return isFullAdmin(access);
    const section = getAdminSectionForPath(entry.key);
    return section !== null && canManageSection(access, section);
  }).map(({ key, label, icon }) => ({ key, label, icon }));
}

// Активный пункт — тот, чей путь является самым длинным префиксом текущего
// (чтобы /admin/news/123 подсвечивал «Новости»). На самом дашборде /admin ни
// один пункт не совпадает — возвращаем undefined (ничего не подсвечено).
export function getSelectedKey(pathname: string): string | undefined {
  return adminNav
    .map((entry) => entry.key)
    .filter((key) => pathname === key || pathname.startsWith(key + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

export function getBreadcrumbItems(pathname: string): BreadcrumbProps["items"] {
  const items: NonNullable<BreadcrumbProps["items"]> = [
    { title: <Link href="/admin">Админка</Link> },
  ];

  const entry = adminNav.find(
    (e) => pathname === e.key || pathname.startsWith(e.key + "/"),
  );

  if (entry) {
    items.push({ title: <Link href={entry.key}>{entry.label}</Link> });
  }

  if (pathname.startsWith("/admin/news/") && pathname !== "/admin/news") {
    items.push({
      title: pathname.endsWith("/new") ? "Создание" : "Редактирование",
    });
  }

  return items;
}
