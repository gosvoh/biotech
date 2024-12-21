import { Montserrat_Alternates } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AnimationProvider from "@/components/animation-provider";

const font = Montserrat_Alternates({
  weight: ["400", "700"],
  subsets: ["cyrillic"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-color-mode="light">
      <body className={`${font.className} antialiased`}>
        <Header />
        <AnimationProvider>{children}</AnimationProvider>
        <Footer />
      </body>
    </html>
  );
}
