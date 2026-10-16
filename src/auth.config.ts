import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  pages: { signIn: "/auth/signin", verifyRequest: "/auth/signin", error: "/auth/signin" },
} satisfies NextAuthConfig;
