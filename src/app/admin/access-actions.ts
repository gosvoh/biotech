"use server";
import { getCurrentAdminAccess } from "@/lib/admin-access.server";

/** No user argument: a client can read only its own fresh, non-secret access. */
export async function readOwnAdminAccess() {
  return getCurrentAdminAccess();
}
