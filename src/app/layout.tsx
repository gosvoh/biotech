import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import { cn } from "@/lib/utils";
import Footer from "@/components/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BioTech.Industries",
  description: "BioTech.Industries",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://biotech.industries",
    description: "BioTech.Industries",
    title: "BioTech.Industries",
    siteName: "BioTech.Industries",
    images: [
      {
        url: "https://biotech.industries/banner.png",
        width: 1024,
        height: 576,
        alt: "BioTech.Industries",
        type: "image/png",
      },
    ],
  },
  authors: [
    { name: "Aleksey Vokhmin", url: "https://github.com/gosvoh" },
    { name: "BioTech.Industries", url: "https://biotech.industries" },
  ],
  creator: "Aleksey Vokhmin",
  applicationName: "BioTech.Industries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={cn(
          inter.className,
          "bg-gray-100 text-gray-900 font-sans min-h-screen",
          "grid grid-rows-[auto,1fr,auto]"
        )}
      >
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
