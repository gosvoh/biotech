import type { Config } from "tailwindcss";
import type { CSSRuleObject, PluginAPI } from "tailwindcss/types/config";
import { parse } from "postcss";
import { objectify } from "postcss-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import animate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        golos: "var(--font-golos)",
        gorizont: "var(--font-gorizont)",
      },
      screens: {
        sm: "576px",
        md: "768px",
        lg: "992px",
        xl: "1200px",
        xxl: "1400px",
        "2xl": "1400px",
      },
      colors: {
        "day-secondary-violet-light": {
          10: "#F2E6FF",
          20: "#E5CCFF",
          30: "#D8B2FF",
          40: "#CC99FF",
          50: "#BF7FFF",
          60: "#B266FF",
          70: "#A64DFF",
          80: "#9933FF",
        },
        "day-secondary-violet-dark": {
          10: "#7200E6",
          20: "#6600CC",
          30: "#5900B2",
          40: "#4C0099",
          50: "#400080",
          60: "#330066",
          70: "#26004D",
          80: "#190033",
        },
        "day-base-static-text&icons": {
          10: "#000000",
          20: "#37394B",
          30: "rgba(27,31,59,0.8)",
          40: "rgba(27,31,59,0.6)",
          50: "rgba(27,31,59,0.4)",
          60: "rgba(27,31,59,0.24)",
          70: "rgba(255,255,255,0.4)",
          80: "rgba(255,255,255,0.7)",
          90: "#FFFFFF",
        },
        "day-base-static-bg&stroke": {
          10: "#FFFFFF",
          20: "#F6F6F6",
          30: "#EDEDED",
          40: "#D7D7D7",
          50: "#B0B0B0",
          60: "#959595",
          70: "#808080",
          80: "#333333",
          90: "#000000",
        },
        "night-base-static-text&icons": {
          10: "#FFFFFF",
          20: "rgba(255,255,255,0.9)",
          30: "rgba(255,255,255,0.8)",
          40: "rgba(255,255,255,0.6)",
          50: "rgba(255,255,255,0.4)",
          60: "rgba(255,255,255,0.24)",
          70: "#C7C9CC",
          80: "#9299A2",
          90: "#333333",
        },
        "night-base-static-bg&stroke": {
          10: "#F6F7F8",
          20: "#EAECEE",
          30: "#DDDFE0",
          40: "#C7C9CC",
          50: "#9299A2",
          60: "#5C636B",
          70: "#333333",
          80: "#000000",
        },
        "day-base-dynamic-transparrent": "rgb(228, 228, 228)",
        "day-base-dynamic-transparrent-hover": "rgb(218, 218, 218)",
        "day-base-dynamic-transparrent-active": "rgb(213, 213, 213)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        "accent-alternate": {
          DEFAULT: "hsl(var(--accent-alternate))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        brand: { DEFAULT: "hsl(var(--brand))" },
        brand3: { DEFAULT: "hsl(var(--brand3))" },
        "typo-secondary": { DEFAULT: "hsl(var(--typo-secondary))" },
        "accent-carbon": { DEFAULT: "hsl(var(--accent-carbon))" },
        "special-dark-gray": { DEFAULT: "hsl(var(--special-dark-gray))" },
        "news-carousel-button": { DEFAULT: "hsl(var(--news-carousel-button))" },
        "day-primary-violet": {
          DEFAULT: "var(--day-primary-violet-default)",
          hover: "var(--day-primary-violet-hover)",
          active: "var(--day-primary-violet-active)",
        },
        "night-primary-violet": {
          DEFAULT: "var(--night-primary-violet-default)",
          hover: "var(--night-primary-violet-hover)",
          active: "var(--night-primary-violet-active)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2.5xl": "calc(var(--radius) + 0.5rem)",
        "2.75xl": "calc(var(--radius) + 0.75rem) /* 24px */",
      },
      fontSize: {
        "2xs": ["0.625rem", "0.75rem"],
        xs: ["0.75rem", "0.9rem"],
        sm: ["0.875rem", "1.05rem"],
        base: ["1rem", "1.2rem"],
        lg: ["1.125rem", "1.35rem"],
        xl: ["1.25rem", "1.5rem"],
        "2xl": ["1.5rem", "1.8rem"],
        "3xl": ["2rem", "2.4rem"],
        "4xl": ["3rem", "3.6rem"],
        "5xl": ["4.5rem", "5.4rem"],
        "6xl": ["6rem", "7.2rem"],
        m_xl: ["18px", "28px"],
        m_lg: ["18px", "28px"],
        m_md: ["16px", "24px"],
        m_sm: ["14px", "20px"],
        m_xs: ["12px", "16px"],
        t_xl: ["18px", "28px"],
        t_lg: ["18px", "28px"],
        t_md: ["16px", "24px"],
        t_sm: ["14px", "20px"],
        t_xs: ["12px", "16px"],
        s_xl: ["20px", "28px"],
        s_lg: ["18px", "28px"],
        s_md: ["16px", "24px"],
        s_sm: ["14px", "20px"],
        s_xs: ["12px", "16px"],
      },
      maxWidth: {
        "1/4": "25%",
        "1/2": "50%",
        "3/4": "75%",
        "1/3": "33.333333%",
        "2/3": "66.666667%",
        "1/5": "20%",
        "2/5": "40%",
        "3/5": "60%",
        "4/5": "80%",
        "1/6": "16.666667%",
        "5/6": "83.333333%",
        "1/12": "8.333333%",
        "5/12": "41.666667%",
        "7/12": "58.333333%",
        "11/12": "91.666667%",
        "11/40": "27.5%",
        "3/8": "37.5%",
        "5/8": "62.5%",
        "7/8": "87.5%",
      },
      height: {
        "10/12": "83.333333%",
        "11/12": "91.666667%",
      },
      translate: {
        "1/12": "8.333333%",
        "2/12": "16.666667%",
        "1/5": "20%",
        "2/5": "40%",
        "1/10": "10%",
        "3/10": "30%",
        "1/20": "5%",
        "3/20": "15%",
      },
      transitionProperty: {
        height: "height",
        width: "width",
        spacing: "margin, padding",
        border: "border",
        "background-size": "background-size",
        shadow: "box-shadow",
        inset: "top, right, bottom, left, inset",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    animate,
    ({ addComponents, addUtilities }: PluginAPI) => {
      const css = readFileSync(
        resolve(process.cwd(), "./src/app/globals.css"),
        "utf8"
      );
      const root = parse(css);
      const jss = objectify(
        root as unknown as Parameters<typeof objectify>[0]
      ) as Record<string, CSSRuleObject>;

      if ("@layer components" in jss) addComponents(jss["@layer components"]);
      if ("@layer utilities" in jss) addUtilities(jss["@layer utilities"]);
    },
  ],
};
export default config;
