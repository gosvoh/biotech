import type { Config } from "tailwindcss";
import type { PluginAPI } from "tailwindcss/types/config";
import { parse } from "postcss";
import { objectify } from "postcss-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
        brand: {
          DEFAULT: "hsl(var(--brand))",
        },
        brand3: {
          DEFAULT: "hsl(var(--brand3))",
        },
        "typo-secondary": {
          DEFAULT: "hsl(var(--typo-secondary))",
        },
        "accent-carbon": {
          DEFAULT: "hsl(var(--accent-carbon))",
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
      transitionProperty: {
        height: "height",
        width: "width",
        spacing: "margin, padding",
        border: "border",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    ({ addBase, addComponents, addUtilities }: PluginAPI) => {
      const css = readFileSync(
        resolve(__dirname, "./src/app/globals.css"),
        "utf8"
      );
      const root = parse(css);
      const jss = objectify(root);

      if ("@layer components" in jss) addComponents(jss["@layer components"]);
      if ("@layer utilities" in jss) addUtilities(jss["@layer utilities"]);
    },
  ],
};
export default config;
