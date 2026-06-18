"use server";

import nodemailer from "nodemailer";
import { Heading, Html, Link, render, Text } from "@react-email/components";
import { z } from "zod";

const questionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(200),
  question: z.string().trim().min(1).max(5000),
});

const transporter = nodemailer.createTransport({
  host: "smtp.timeweb.ru",
  auth: {
    user: process.env.MAIL_USER!,
    pass: process.env.MAIL_PASS!,
  },
  port: 465,
  secure: true,
  dkim: {
    domainName: process.env.DKIM_DOMAIN!,
    keySelector: "mail",
    privateKey: process.env.DKIM_PRIVATE_KEY!,
  },
});

function Email({
  name,
  email,
  question,
}: {
  name: string;
  email: string;
  question: string;
}) {
  return (
    <Html lang="ru">
      <Heading>{name}</Heading>
      <Link href={`mailto:${email}`}>{email}</Link>
      <Text>{question}</Text>
    </Html>
  );
}

export async function sendMail(input: unknown) {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return false;
  const data = parsed.data;
  try {
    const mailOptions = {
      from: process.env.MAIL_USER!,
      to: process.env.MAIL_TO!,
      subject: "Вопрос декану",
      text: await render(<Email {...data} />, { plainText: true }),
      html: await render(<Email {...data} />),
    };

    const res = await transporter.sendMail(mailOptions);
    if (res.accepted.length) return true;
    else return false;
  } catch (error) {
    console.error(error);
    return false;
  }
}
