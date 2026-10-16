"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function requestSignIn(_previous: { submitted: boolean }, data: FormData): Promise<{ submitted: boolean }> {
  try {
    // Invitation actions in Task 4 must call this same server signIn flow after
    // authorizing the administrator; never construct tokens or SMTP mail there.
    await signIn("nodemailer", { email: data.get("email"), redirect: false, redirectTo: "/admin" });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }
  return { submitted: true };
}
