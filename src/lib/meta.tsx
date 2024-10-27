import { ImageResponse } from "next/og";
import type { Metadata } from "next";
import type React from "react";

export const generateOGImage = async (
  title: string,
  textStyle?: React.CSSProperties
) => {
  const Montserrat_Alternates = fetch(
    new URL("@public/MontserratAlternates-Black.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

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
          <img
            src="http://localhost:3000/Biotech-Logotype.png"
            alt="Biotech"
            style={{
              width: 300,
              filter: "invert(1)",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
          <p
            style={{
              textAlign: "center",
              marginInline: "auto",
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

export const generateMeta = (title: string, description: string): Metadata => ({
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
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    site: "@biotech",
    creator: "@gosvoh",
  },
});
