"use server";

import { auth, signIn } from "@/auth";
import { actionResult, dbAction, dbActionWithResult } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import {
  changeAdminUserRole, createAdminUser, deleteAdminUser, getAdminInvitationRecipient,
  parseAdminUserId, setAdminUserBlocked, updateAdminUserAccess,
} from "@/lib/admin-users";
import { observeAuthMailDelivery } from "@/lib/auth-mail-outcome.server";

async function actorId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Требуется вход администратора.");
  return parseAdminUserId(session.user.id);
}

export async function createUser(input: unknown) {
  return actionResult(async () => {
    return dbActionWithResult(createAdminUser(prisma, await actorId(), input), "users");
  });
}

export async function updateUserAccess(userId: unknown, input: unknown) {
  return actionResult(async () => {
    return dbActionWithResult(updateAdminUserAccess(prisma, await actorId(), parseAdminUserId(userId), input), "users");
  });
}

export async function changeRole(userId: unknown, role: unknown) {
  return actionResult(async () => {
    await dbAction(changeAdminUserRole(prisma, await actorId(), parseAdminUserId(userId), role), "users");
  });
}

export async function setUserBlocked(userId: unknown, blocked: unknown) {
  return actionResult(async () => {
    await dbAction(setAdminUserBlocked(prisma, await actorId(), parseAdminUserId(userId), blocked), "users");
  });
}

export async function deleteUser(userId: unknown) {
  return actionResult(async () => {
    await dbAction(deleteAdminUser(prisma, await actorId(), parseAdminUserId(userId)), "users");
  });
}

export async function sendUserInvitation(userId: unknown) {
  return actionResult(async () => {
    const email = await getAdminInvitationRecipient(prisma, await actorId(), parseAdminUserId(userId));
    const outcome = await observeAuthMailDelivery(() => signIn("nodemailer", { email, redirect: false }));
    if (outcome === "rate-limited") throw new Error("Достигнут лимит отправки писем. Повторите позже.");
    if (outcome === "unavailable") throw new Error("Пользователь больше не доступен для приглашения.");
    if (outcome !== "sent") throw new Error("Не удалось отправить приглашение. Повторите позже.");
  });
}
