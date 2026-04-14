import localFont from "next/font/local";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SessionProvider } from "next-auth/react";
import Script from "next/script";

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
        <Footer />
        <Script
          data-embed-id="e4675477-ad57-4532-a1fc-1a3a966adf8d"
          data-base-api-url="https://llm.cedne.netcraze.link/api/embed"
          src="https://llm.cedne.netcraze.link/embed/anythingllm-chat-widget.min.js"
          data-language="ru"
          data-chat-icon="chatBubble"
          data-brand-image-url="/favicon.ico"
          data-assistant-icon="/favicon.ico"
          data-no-sponsor="true"
          data-assistant-name="Секретарь факультета биотехнологий"
          data-support-email="biotech@itmo.ru"
          data-greeting="Привет! Я Секретарь факультета биотехнологий. Чем могу помочь?"
        />
      </body>
    </html>
  );
}
