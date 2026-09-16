import { SITE_URL, siteUrl } from "@/lib/site";
import { ImageResponse } from "next/og";
import { type Metadata } from "next";
import type React from "react";
import { join } from "path";
import { readFile } from "fs/promises";

export const generateOGImage = async (
  title: string,
  textStyle?: React.CSSProperties,
) => {
  const gorizontFont = readFile(
    join(process.cwd(), "public/ALSGorizont-BoldExpanded.otf"),
  ).catch(() =>
    readFile(join(process.cwd(), "src/app/fonts/ALSGorizont-BoldExpanded.otf")),
  );
  const logoDataUrl = readFile(
    join(process.cwd(), "public/Biotech-Logotype.svg"),
    "utf8",
  ).then(
    (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
  const [fontData, logoSrc] = await Promise.all([gorizontFont, logoDataUrl]);

  return new ImageResponse(
    <div
      style={{
        fontSize: 64,
        backgroundColor: "hsl(0, 0%, 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "hsl(0, 0%, 0%)",
        marginInline: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          maxHeight: 660,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <picture
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 300,
          }}
        >
          <img src={logoSrc} alt="Biotech" width={300} height={98} />
        </picture>
        <p
          style={{
            textAlign: "center",
            marginInline: "auto",
            color: "hsl(270, 100%, 50%)",
            alignSelf: "center",
            ...textStyle,
          }}
        >
          {title}
        </p>
      </div>
    </div>,
    {
      width: 1920,
      height: 960,
      fonts: [
        {
          name: "ALS Gorizont",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
};

export const generateMeta = (
  title: string,
  description: string,
  pathname = "/",
): Metadata => {
  const url = siteUrl(pathname);
  const imagePath = new URL(url).pathname.replace(/\/$/, "");
  return {
    title: { absolute: title },
    description,
    icons: "/favicon.ico",
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    creator: "Aleksey Vokhmin",
    openGraph: {
      type: "website",
      locale: "ru_RU",
      title,
      description,
      url,
      images: {
        url: siteUrl(`${imagePath}/opengraph-image`),
        width: 1920,
        height: 960,
        alt: title,
      },
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: {
        url: siteUrl(`${imagePath}/twitter-image`),
        width: 1920,
        height: 960,
        alt: title,
      },
    },
  };
};
