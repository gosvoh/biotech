import Footer from "@/components/footer";
import { DesktopNavbar, MobileNavbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BioTech",
  description: "BioTech",
  metadataBase: new URL("https://biotech.cedne.ru"),
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://biotech.cedne.ru",
    description: "BioTech",
    title: "BioTech",
    siteName: "BioTech",
    images: [
      {
        url: "https://biotech.cedne.ru/banner.png",
        width: 1024,
        height: 576,
        alt: "BioTech",
        type: "image/png",
      },
    ],
  },
  authors: [
    { name: "Aleksey Vokhmin", url: "https://github.com/gosvoh" },
    { name: "BioTech", url: "https://biotech.cedne.ru" },
  ],
  creator: "Aleksey Vokhmin",
  applicationName: "BioTech",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AntdRegistry>
            <DesktopNavbar className="hidden md:block" />
            <MobileNavbar className="md:hidden" />
            {children}
            <Footer />
          </AntdRegistry>
        </ThemeProvider>
      </body>
    </html>
  );
}
