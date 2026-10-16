import type { NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import type { PrismaClient } from "@/lib/db/client";
import authConfig from "@/auth.config";
import { getApprovedAccount, normalizeAdminEmail } from "./auth-access";
import { createApprovedAuthAdapter, createAuthAttemptContext } from "./auth-adapter";
import { consumeAuthQuota, getAuthClientAddress } from "./auth-rate-limit";
import { getAuthMailObserver } from "./auth-mail-outcome.server";

const verificationPath = "/api/auth/verify-request?provider=nodemailer&type=email";
function positiveSetting(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("Invalid auth quota configuration");
  return parsed;
}

// Call once per Auth invocation, including lazy NextAuth server actions. Never
// cache this object: its adapter captures exactly one verification attempt.
export function createAuthConfig(db: PrismaClient, headers: Headers): NextAuthConfig {
  const context = createAuthAttemptContext();
  const reportMail = getAuthMailObserver();
  const secret = process.env.AUTH_SECRET;
  const quota = {
    minute: positiveSetting(process.env.AUTH_EMAIL_MINUTE_LIMIT, 1),
    minuteSeconds: positiveSetting(process.env.AUTH_EMAIL_MINUTE_SECONDS, 60),
    hour: positiveSetting(process.env.AUTH_EMAIL_HOUR_LIMIT, 5),
    hourSeconds: positiveSetting(process.env.AUTH_EMAIL_HOUR_SECONDS, 3600),
    request: positiveSetting(process.env.AUTH_REQUEST_LIMIT, 30),
    requestSeconds: positiveSetting(process.env.AUTH_REQUEST_SECONDS, 600),
  };
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  const provider = Nodemailer({
    name: "Email", from: process.env.EMAIL_FROM,
    server: { host: process.env.EMAIL_SERVER_HOST, port, secure: port === 465, auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD } },
    normalizeIdentifier(value) {
      // An invalid address follows the same neutral public path and IP quota.
      try { return normalizeAdminEmail(value); } catch { return ""; }
    },
  });
  const send = provider.sendVerificationRequest;
  provider.options = { ...provider.options, async sendVerificationRequest(params) {
    // Auth core starts send and token creation concurrently. Wait until the
    // revision-pinned token exists, then recheck before invoking SMTP.
    if (!await context.tokenStored) { reportMail("unavailable"); return; }
    const user = await getApprovedAccount(db, params.identifier);
    if (!user || user.id !== context.issuance?.userId || user.accessRevision !== context.issuance.revision) { reportMail("unavailable"); return; }
    try {
      await send(params);
      reportMail("sent");
    } catch (error) { reportMail("failed"); throw error; }
  } };
  return {
    ...authConfig, secret, providers: [provider],
    adapter: createApprovedAuthAdapter(db, context), session: { strategy: "database" },
    // Auth.js errors may carry raw provider/adapter arguments. Only emit the
    // stable error class; never log token, email URL or SMTP credentials.
    logger: { error(error) { console.error("Authentication failed", "type" in error ? error.type : "AuthError"); } },
    callbacks: {
      authorized: ({ auth }) => !!auth,
      async signIn({ user, email }) {
        if (!email?.verificationRequest) {
          const account = await getApprovedAccount(db, user.email);
          return !!account && account.id === context.verified?.userId && account.accessRevision === context.verified.revision;
        }
        const now = new Date(Date.now());
        const address = getAuthClientAddress(headers, process.env.AUTH_TRUSTED_IP_HEADER);
        const requestQuota = await consumeAuthQuota(db, { scope: address ? "request-ip" : "request-unknown", subject: address ?? "shared", limit: quota.request, windowSeconds: quota.requestSeconds, now, secret });
        if (!requestQuota.allowed) { reportMail("rate-limited"); return verificationPath; }
        const account = await getApprovedAccount(db, user.email);
        if (!account) { reportMail("unavailable"); return verificationPath; }
        const normalized = normalizeAdminEmail(account.email);
        const minute = await consumeAuthQuota(db, { scope: "email-minute", subject: normalized, limit: quota.minute, windowSeconds: quota.minuteSeconds, now, secret });
        if (!minute.allowed) { reportMail("rate-limited"); return verificationPath; }
        const hour = await consumeAuthQuota(db, { scope: "email-hour", subject: normalized, limit: quota.hour, windowSeconds: quota.hourSeconds, now, secret });
        if (!hour.allowed) { reportMail("rate-limited"); return verificationPath; }
        context.issuance = { userId: account.id, email: normalized, revision: account.accessRevision };
        return true;
      },
      redirect({ url, baseUrl }) {
        if (url === verificationPath || url === `${baseUrl}${verificationPath}`) return `${baseUrl}${verificationPath}`;
        return `${baseUrl}/admin`;
      },
      session({ session, user }) {
        return { ...session, user: { ...session.user, id: user.id, role: user.role } };
      },
    },
  };
}
