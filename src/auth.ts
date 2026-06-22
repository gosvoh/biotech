import NextAuth, { type DefaultSession } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";
import authConfig from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    role: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Duplicate @auth/core installs (one hoisted, one nested under next-auth)
  // yield two structurally-identical but nominally-distinct `Adapter` types.
  // Cast to next-auth's own `Adapter` so the return type is assignable here
  // deterministically (a `@ts-expect-error`/`@ts-ignore` would be flaky: the
  // mismatch only surfaces depending on type-resolution order).
  adapter: PrismaAdapter(prisma) as Adapter,
  callbacks: {
    authorized: async ({ auth }) => !!auth,
    session({ session, user }) {
      return {
        ...session,
        user: {
          ...session.user,
          role: user.role,
        },
      };
    },
  },
  ...authConfig,
});
