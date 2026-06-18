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
  // @ts-expect-error - duplicate @auth/core installs (one hoisted, one nested
  // under next-auth) yield two structurally-identical but nominally-distinct
  // `Adapter` types, so PrismaAdapter's return type is not assignable here.
  // Resolvable only by deduping @auth/core in package.json, which is upstream.
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
