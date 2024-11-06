import Resend from "next-auth/providers/resend";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [Resend({ from: process.env.EMAIL_FROM })],
} satisfies NextAuthConfig;
