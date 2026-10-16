import NextAuth, { type DefaultSession } from "next-auth";
import { headers } from "next/headers";
import { prisma } from "@/prisma";
import { createAuthConfig } from "@/lib/auth-config.server";

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

export const { handlers, signIn, signOut, auth } = NextAuth(async (request) =>
  createAuthConfig(prisma, new Headers(request?.headers ?? await headers()))
);
