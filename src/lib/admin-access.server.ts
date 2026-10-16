import { auth, signIn } from "@/auth";
import { prisma } from "@/prisma";
import { redirect } from "next/navigation";
import { ADMIN_SECTIONS, canManageSection, isFullAdmin, type AdminAccess, type AdminSection } from "./admin-access";

/** Request-local read only: never cache session identity or permissions. */
export async function getCurrentAdminAccess(): Promise<AdminAccess | null> {
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_ADMIN_AUTH === "true") {
    return { userId: "dev-auth-bypass", role: "admin", status: "active", sections: [] };
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, accessStatus: true, sectionPermissions: { select: { section: true } } },
  });
  if (!user || (user.role !== "admin" && user.role !== "user") ||
    !["active", "pending", "blocked"].includes(user.accessStatus)) return null;
  return {
    userId: user.id, role: user.role, status: user.accessStatus as AdminAccess["status"],
    sections: ADMIN_SECTIONS.filter(entry => user.sectionPermissions.some(grant => grant.section === entry.code)).map(entry => entry.code),
  };
}

export async function requireAdminSection(section: AdminSection): Promise<AdminAccess> {
  const access = await getCurrentAdminAccess();
  if (!access || !canManageSection(access, section)) throw new Error("Недостаточно прав для этого раздела.");
  return access;
}

export async function requireFullAdmin(): Promise<AdminAccess> {
  const access = await getCurrentAdminAccess();
  if (!access || !isFullAdmin(access)) throw new Error("Недостаточно прав администратора.");
  return access;
}

export async function requireAdminAccessPage(): Promise<AdminAccess> {
  const access = await getCurrentAdminAccess();
  if (!access) {
    await signIn(undefined, { redirectTo: "/admin" });
    // signIn redirects in production; fail closed if an integration returns.
    throw new Error("Требуется вход.");
  }
  if (access.status !== "active") redirect("/admin/forbidden");
  return access;
}

export async function requireAdminSectionPage(section: AdminSection): Promise<AdminAccess> {
  const access = await requireAdminAccessPage();
  if (!canManageSection(access, section)) redirect("/admin/forbidden");
  return access;
}

export async function requireFullAdminPage(): Promise<AdminAccess> {
  const access = await requireAdminAccessPage();
  if (!isFullAdmin(access)) redirect("/admin/forbidden");
  return access;
}
