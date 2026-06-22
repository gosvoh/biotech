import NextAuth, { type DefaultSession } from "next-auth";
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
  // @ts-ignore - duplicate @auth/core installs (one hoisted, one nested under
  // next-auth) yield two structurally-identical but nominally-distinct
  // `Adapter` types, so PrismaAdapter's return type is not assignable here.
  // Whether the mismatch surfaces depends on type-resolution order, so this
  // uses @ts-ignore (not @ts-expect-error, which itself errors when the
  // mismatch is absent). Resolvable only by deduping @auth/core upstream.
  adapter: PrismaAdapter(prisma),
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
