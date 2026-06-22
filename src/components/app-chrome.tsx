"use client";

import { usePathname } from "next/navigation";

export default function AppChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const isAdmin = usePathname()?.startsWith("/admin") ?? false;

  return (
    <>
      {!isAdmin && header}
      {children}
      {!isAdmin && footer}
    </>
  );
}
