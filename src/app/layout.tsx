import localFont from "next/font/local";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AnimationProvider from "@/components/animation-provider";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://biotech.cedne.ru"),
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
        <AnimationProvider />
        <Footer />
      </body>
    </html>
  );
}
