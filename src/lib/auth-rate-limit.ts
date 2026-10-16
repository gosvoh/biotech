import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { PrismaClient } from "@/lib/db/client";

export function getAuthClientAddress(headers: Headers, configuredHeader?: string): string | null {
  if (!configuredHeader || !/^[a-z0-9-]+$/i.test(configuredHeader)) return null;
  const value = headers.get(configuredHeader)?.trim();
  if (!value || value.includes("%") || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return canonical;
}

export async function consumeAuthQuota(db: PrismaClient, input: {
  scope: string; subject: string; limit: number; windowSeconds: number; now: Date; secret?: string;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { scope, subject, limit, windowSeconds, now } = input;
  const secret = input.secret ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || !Number.isFinite(+now)) throw new Error("Invalid auth quota");
  const digest = createHmac("sha256", secret).update(JSON.stringify([scope, subject])).digest("hex");
  const lower = `${digest}:`, upper = `${digest};`;
  // One row per admitted request gives an exact rolling window. The conditional
  // INSERT is one SQLite write statement, atomic even across processes/clients.
  const admitted = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO AuthRateLimit (key, count, expiresAt)
    SELECT ${lower + randomUUID()}, 1, ${new Date(+now + windowSeconds * 1000)}
    WHERE (SELECT count(*) FROM AuthRateLimit WHERE key >= ${lower} AND key < ${upper} AND expiresAt > ${now}) < ${limit}
    RETURNING key`;
  const earliest = admitted.length ? null : await db.authRateLimit.findFirst({
    where: { key: { gte: lower, lt: upper }, expiresAt: { gt: now } }, orderBy: { expiresAt: "asc" }, select: { expiresAt: true },
  });
  await db.$executeRaw`DELETE FROM AuthRateLimit WHERE key IN (SELECT key FROM AuthRateLimit WHERE expiresAt <= ${now} ORDER BY expiresAt LIMIT 100)`;
  return { allowed: admitted.length === 1, retryAfterSeconds: admitted.length ? 0 : Math.max(1, Math.ceil((+(earliest?.expiresAt ?? now) - +now) / 1000)) };
}
