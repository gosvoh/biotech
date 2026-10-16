import { z } from "zod";
import type { Prisma, PrismaClient } from "@/lib/db/client";
import { ADMIN_SECTIONS, type AdminAccess, type AdminSection } from "./admin-access";
import { getApprovedAccount, normalizeAdminEmail } from "./auth-access";

const sectionSchema = z.enum(["members", "disciplines", "scientific-works", "news", "publications"]);
export const adminUserAccessSchema = z.strictObject({
  role: z.enum(["admin", "user"]),
  sections: z.array(sectionSchema).max(5).refine((items) => new Set(items).size === items.length),
});
export const createAdminUserSchema = adminUserAccessSchema.extend({ email: z.string().transform(normalizeAdminEmail) });
export type AdminUserAccessInput = z.input<typeof adminUserAccessSchema>;
export type CreateAdminUserInput = z.input<typeof createAdminUserSchema>;
const idSchema = z.string().trim().min(1).max(200);
export function parseAdminUserId(value: unknown): string { return idSchema.parse(value); }

function retryableWriteConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? error.code : undefined;
  return code === "P1008" || code === "P2034" ||
    ((code === "P2028" || code === "P2010") && /locked|busy|write conflict|expired|closed/i.test(error.message));
}

async function adminTransaction<T>(db: PrismaClient, actorId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const actor = parseAdminUserId(actorId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Acquire SQLite's write lock before reading actor/remaining admins.
        // A deferred read-then-write transaction cannot safely upgrade a stale snapshot.
        await tx.$executeRaw`UPDATE User SET accessRevision = accessRevision WHERE id = ${actor}`;
        await requireActiveAdmin(tx, actor);
        return operation(tx);
      }, { maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!retryableWriteConflict(error)) throw error;
      if (attempt >= 2) throw new Error("Конфликт сохранения. Повторите действие.");
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

/** Fresh database guard, usable inside callers' transactions; never trusts session role. */
export async function requireActiveAdmin(db: PrismaClient | Prisma.TransactionClient, actorId: string): Promise<void> {
  const actor = await db.user.findUnique({ where: { id: parseAdminUserId(actorId) } });
  if (!actor || actor.role !== "admin" || actor.accessStatus !== "active") throw new Error("Недостаточно прав администратора.");
}

async function targetUser(tx: Prisma.TransactionClient, targetId: string) {
  const target = await tx.user.findUnique({ where: { id: parseAdminUserId(targetId) }, include: { sectionPermissions: true } });
  if (!target) throw new Error("Пользователь не найден.");
  return target;
}

function access(user: { id: string; role: string; accessStatus: string }, sections: readonly string[]): AdminAccess {
  return {
    userId: user.id, role: user.role as AdminAccess["role"], status: user.accessStatus as AdminAccess["status"],
    sections: ADMIN_SECTIONS.filter((section) => sections.includes(section.code)).map((section) => section.code),
  };
}

async function removeEmailTokens(tx: Prisma.TransactionClient, email: string | null) {
  if (email === null) return;
  await tx.$executeRaw`DELETE FROM VerificationToken WHERE lower(trim(identifier)) = ${email.trim().toLowerCase()}`;
}

async function protectAdmin(tx: Prisma.TransactionClient, actorId: string, target: { id: string; role: string; accessStatus: string }) {
  if (actorId === target.id) throw new Error("Нельзя понизить, заблокировать или удалить собственный аккаунт.");
  if (target.role === "admin" && target.accessStatus === "active" &&
    await tx.user.count({ where: { role: "admin", accessStatus: "active" } }) <= 1) {
    throw new Error("Нельзя удалить последнего активного администратора.");
  }
}

export async function createAdminUser(db: PrismaClient, actorId: string, input: unknown): Promise<AdminAccess> {
  const parsed = createAdminUserSchema.parse(input);
  return adminTransaction(db, actorId, async (tx) => {
    const duplicates = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(trim(email)) = ${parsed.email} LIMIT 1`;
    if (duplicates.length) throw new Error("Пользователь с таким email уже существует.");
    // Legacy tokens can outlive deleted/absent accounts and bind revision 0.
    await removeEmailTokens(tx, parsed.email);
    const user = await tx.user.create({ data: {
      email: parsed.email, emailVerified: null, role: parsed.role, accessStatus: "active",
      sectionPermissions: { create: parsed.sections.map((section) => ({ section })) },
    } });
    return access(user, parsed.sections);
  });
}

async function updateAccess(tx: Prisma.TransactionClient, actorId: string, targetId: string, role: "admin" | "user", sections?: AdminSection[]) {
  const target = await targetUser(tx, targetId);
  if (role !== "admin" && target.role === "admin") await protectAdmin(tx, actorId, target);
  const selected = sections ?? target.sectionPermissions.map((entry) => sectionSchema.parse(entry.section));
  await tx.userSectionPermission.deleteMany({ where: { userId: target.id } });
  if (selected.length) await tx.userSectionPermission.createMany({ data: selected.map((section) => ({ userId: target.id, section })) });
  // Permission edits retain sessions; protected requests must read fresh grants.
  const user = await tx.user.update({ where: { id: target.id }, data: { role } });
  return access(user, selected);
}

export async function updateAdminUserAccess(db: PrismaClient, actorId: string, targetId: string, input: unknown): Promise<AdminAccess> {
  const parsed = adminUserAccessSchema.parse(input);
  return adminTransaction(db, actorId, (tx) => updateAccess(tx, actorId, targetId, parsed.role, parsed.sections));
}

/** Existing role control reads and preserves grants inside the transaction. */
export async function changeAdminUserRole(db: PrismaClient, actorId: string, targetId: string, role: unknown): Promise<AdminAccess> {
  const parsed = adminUserAccessSchema.shape.role.parse(role);
  return adminTransaction(db, actorId, (tx) => updateAccess(tx, actorId, targetId, parsed));
}

export async function setAdminUserBlocked(db: PrismaClient, actorId: string, targetId: string, blocked: unknown): Promise<void> {
  const shouldBlock = z.boolean().parse(blocked);
  return adminTransaction(db, actorId, async (tx) => {
    const target = await targetUser(tx, targetId);
    if (shouldBlock) {
      await protectAdmin(tx, actorId, target);
      await tx.user.update({ where: { id: target.id }, data: { accessStatus: "blocked", accessRevision: { increment: 1 } } });
      await tx.session.deleteMany({ where: { userId: target.id } });
      await removeEmailTokens(tx, target.email);
    } else {
      await tx.user.update({ where: { id: target.id }, data: { accessStatus: "active" } });
    }
  });
}

export async function deleteAdminUser(db: PrismaClient, actorId: string, targetId: string): Promise<void> {
  return adminTransaction(db, actorId, async (tx) => {
    const target = await targetUser(tx, targetId);
    await protectAdmin(tx, actorId, target);
    await removeEmailTokens(tx, target.email);
    await tx.user.delete({ where: { id: target.id } });
  });
}

export async function getAdminInvitationRecipient(db: PrismaClient, actorId: string, targetId: string): Promise<string> {
  return adminTransaction(db, actorId, async (tx) => {
    const target = await targetUser(tx, targetId);
    if (!target.email || target.accessStatus !== "active") throw new Error("Приглашение доступно только активному пользователю с email.");
    const approved = await getApprovedAccount(tx, target.email);
    if (!approved || approved.id !== target.id) throw new Error("Email пользователя неоднозначен.");
    return normalizeAdminEmail(target.email);
  });
}
