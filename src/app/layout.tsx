import localFont from "next/font/local";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SessionProvider } from "next-auth/react";
import ChatWidget from "@/components/chat-widget";

export const metadata: Metadata = {
  metadataBase: new URL("https://biotech.cedne.ru"),
  title: {
    default: "Биотех ИТМО",
    template: "%s | Биотех ИТМО",
  },
  description:
    "Факультет биотехнологий Университета ИТМО: новости, команда, научные исследования и образовательные программы.",
};

const golosFont = localFont({
  src: "./fonts/Golos-Text_Regular.ttf",
  display: "swap",
  variable: "--font-golos",
});

const gorizontFont = localFont({
  src: "./fonts/ALS Gorizont Variable.ttf",
  display: "swap",
  variable: "--font-gorizont",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-color-mode="light">
      <body
        className={`${golosFont.variable} ${gorizontFont.variable} antialiased`}
      >
        <SessionProvider>
          <Header />
        </SessionProvider>
        {children}
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
