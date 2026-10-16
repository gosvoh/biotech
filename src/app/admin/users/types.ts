import type { AdminAccess, AdminSection } from "@/lib/admin-access";

/** Explicit public projection; no session, token or adapter fields cross this boundary. */
export type AdminUserView = {
  id: string;
  email: string | null;
  name: string | null;
  role: AdminAccess["role"];
  accessStatus: AdminAccess["status"];
  sections: AdminSection[];
  createdAt: string;
};

export const USER_STATUS_LABELS = { pending: "Ожидает доступа", active: "Активен", blocked: "Заблокирован" };
export function userTypeLabel(user: Pick<AdminUserView, "role" | "sections">) {
  return user.role === "admin" ? "Администратор" : user.sections.length ? "Редактор" : "Без разделов";
}
