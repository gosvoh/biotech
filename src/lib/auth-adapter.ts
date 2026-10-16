import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomUUID } from "node:crypto";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { PrismaClient, Session, VerificationToken } from "@/lib/db/client";
import { getApprovedAccount, normalizeAdminEmail } from "./auth-access";

type Approval = { userId: string; email: string; revision: number };
export type AuthAttemptContext = {
  issuance?: Approval;
  verified?: Approval;
  tokenStored: Promise<boolean>;
  settleToken: (stored: boolean) => void;
};
export function createAuthAttemptContext(): AuthAttemptContext {
  let settleToken!: (stored: boolean) => void;
  const tokenStored = new Promise<boolean>((resolve) => { settleToken = resolve; });
  return { tokenStored, settleToken };
}

export function createApprovedAuthAdapter(db: PrismaClient, context: AuthAttemptContext): Adapter {
  const base = PrismaAdapter(db) as Adapter;
  return {
    ...base,
    async createUser() { throw new Error("Administrative account creation required"); },
    async getUserByEmail(email) { return await getApprovedAccount(db, email) as AdapterUser | null; },
    async createVerificationToken(data) {
      try {
        const approval = context.issuance;
        if (!approval || normalizeAdminEmail(data.identifier) !== approval.email) throw new Error("Unapproved token issuance");
        const now = new Date();
        // SQLite executes the revision check and insert as one atomic write.
        // Avoid holding an interactive transaction across awaited Prisma calls:
        // concurrent quota writers can otherwise starve its next statement.
        const tokens = await db.$queryRaw<VerificationToken[]>`
          INSERT INTO VerificationToken (identifier, token, expires, accessRevision, createdAt, updatedAt)
          SELECT ${data.identifier}, ${data.token}, ${data.expires}, accessRevision, ${now}, ${now}
          FROM User WHERE id = ${approval.userId} AND accessStatus = 'active' AND accessRevision = ${approval.revision}
            AND lower(trim(email)) = ${approval.email}
            AND (SELECT count(*) FROM User WHERE lower(trim(email)) = ${approval.email}) = 1
          RETURNING *`;
        if (tokens.length !== 1) throw new Error("Revoked token issuance");
        context.settleToken(true);
        return tokens[0];
      } catch (error) { context.settleToken(false); throw error; }
    },
    async useVerificationToken(identifier_token) {
      context.verified = undefined;
      // Capture identity in the same SQLite write that consumes the token.
      // Looking it up after await could bind a consumed legacy token to a new
      // account created with the same email and revision after deletion.
      const tokens = await db.$queryRaw<(VerificationToken & { approvedUserId: string | null })[]>`
        DELETE FROM VerificationToken
        WHERE identifier = ${identifier_token.identifier} AND token = ${identifier_token.token}
        RETURNING *, (
          SELECT u.id FROM User AS u
          WHERE lower(trim(u.email)) = lower(trim(VerificationToken.identifier))
            AND u.accessStatus = 'active' AND u.accessRevision = VerificationToken.accessRevision
            AND (SELECT count(*) FROM User AS candidate
              WHERE lower(trim(candidate.email)) = lower(trim(VerificationToken.identifier))) = 1
        ) AS approvedUserId`;
      const consumed = tokens[0];
      if (!consumed) return null;
      const { approvedUserId, ...token } = consumed;
      if (!approvedUserId || token.expires <= new Date()) return null;
      context.verified = { userId: approvedUserId, email: normalizeAdminEmail(token.identifier), revision: token.accessRevision };
      return token;
    },
    async updateUser(data) {
      const approval = context.verified;
      if (!approval || approval.userId !== data.id) throw new Error("Unverified account");
      return await db.user.update({ where: { id: data.id, accessStatus: "active", accessRevision: approval.revision }, data: { emailVerified: data.emailVerified } }) as AdapterUser;
    },
    async createSession(data) {
      const approval = context.verified;
      if (!approval || data.userId !== approval.userId) throw new Error("Unverified session");
      const now = new Date();
      // Batch transaction has no asynchronous gaps between acquiring its write
      // lock and committing. Task 4 revocations must increment revision and
      // delete sessions together; either ordering then revokes this attempt.
      const [sessions] = await db.$transaction([db.$queryRaw<Session[]>`
        INSERT INTO Session (id, sessionToken, userId, expires, createdAt, updatedAt)
        SELECT ${randomUUID()}, ${data.sessionToken}, id, ${data.expires}, ${now}, ${now}
        FROM User WHERE id = ${data.userId} AND accessStatus = 'active' AND accessRevision = ${approval.revision}
          AND lower(trim(email)) = ${approval.email}
          AND (SELECT count(*) FROM User WHERE lower(trim(email)) = ${approval.email}) = 1
        RETURNING *`]);
      if (sessions.length !== 1) throw new Error("Revoked session attempt");
      context.verified = undefined;
      return sessions[0];
    },
    async getSessionAndUser(sessionToken) {
      const record = await db.session.findUnique({ where: { sessionToken }, include: { user: true } });
      if (!record || record.user.accessStatus !== "active") return null;
      const { user, ...session } = record;
      return { session, user: user as AdapterUser };
    },
  };
}
