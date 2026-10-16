import type { Prisma, PrismaClient } from "@/lib/db/client";

export function normalizeAdminEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(email)) throw new Error("Invalid email");
  const [local, domain] = email.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..") || domain.split(".").some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) throw new Error("Invalid email");
  return email;
}

export async function getApprovedAccount(db: PrismaClient | Prisma.TransactionClient, value: unknown) {
  let email: string;
  try { email = normalizeAdminEmail(value); } catch { return null; }
  // SQLite's ordinary unique email index is case-sensitive. Preserve legacy
  // casing without choosing arbitrarily between two canonical duplicates.
  const matches = await db.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(trim(email)) = ${email} LIMIT 2`;
  if (matches.length !== 1) return null;
  return db.user.findFirst({ where: { id: matches[0].id, accessStatus: "active" } });
}
