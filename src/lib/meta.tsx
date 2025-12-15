import { ImageResponse } from "next/og";
import { type Metadata } from "next";
import type React from "react";
import { join } from "path";
import { readFile } from "fs/promises";

export const generateOGImage = async (
  title: string,
  textStyle?: React.CSSProperties
) => {
  const Montserrat_Alternates = readFile(
    join(process.cwd(), "public/MontserratAlternates-Black.ttf")
  ).then((res) => Uint8Array.from(res).buffer);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          backgroundColor: "hsl(0, 0%, 15%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
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
            <img
              src="https://biotech.cedne.ru/Biotech-Logotype.png"
              alt="Biotech"
              style={{ filter: "invert(1)" }}
            />
          </picture>
          <p
            style={{
              textAlign: "center",
              marginInline: "auto",
              color: "hsl(156, 99%, 41%)",
              outline: "2px solid red",
              alignSelf: "center",
              ...textStyle,
            }}
          >
            {title}
          </p>
        </div>
      </div>
    ),
    {
      width: 1920,
      height: 960,
      fonts: [
        {
          name: "Montserrat Alternates",
          data: await Montserrat_Alternates,
          style: "normal",
          weight: 900,
        },
      ],
    }
  );
};

export const generateMeta = (
  title: string,
  description: string,
  imageBaseUrl?: string
): Metadata => ({
  title,
  description,
  icons: "favicon.ico",
  metadataBase: new URL("https://biotech.cedne.ru"),
  creator: "Aleksey Vokhmin",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title,
    description,
    images: {
      url: `${
        imageBaseUrl?.startsWith("http")
          ? imageBaseUrl
          : `https://biotech.cedne.ru${imageBaseUrl ?? ""}`
      }/opengraph-image`,
      width: 1920,
      height: 960,
    },
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    site: "@biotech",
    creator: "@gosvoh",
    images: {
      url: `${
        imageBaseUrl?.startsWith("http")
          ? imageBaseUrl
          : `https://biotech.cedne.ru${imageBaseUrl ?? ""}`
      }/opengraph-image`,
      width: 1920,
      height: 960,
    },
  },
});
