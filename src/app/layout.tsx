import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AnimationProvider from "@/components/animation-provider";
import { SessionProvider } from "next-auth/react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

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
        <AntdRegistry>
          <SessionProvider>
            <Header />
          </SessionProvider>
          <AnimationProvider>{children}</AnimationProvider>
          <Footer />
        </AntdRegistry>
      </body>
    </html>
  );
}
