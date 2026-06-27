import Nodemailer from "next-auth/providers/nodemailer";
import type { NextAuthConfig } from "next-auth";

// Port 465 uses implicit TLS (secure), 587 upgrades via STARTTLS.
const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);

export default {
  providers: [
    Nodemailer({
      name: "Email",
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
} satisfies NextAuthConfig;
