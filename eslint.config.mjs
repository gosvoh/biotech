import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const eslintConfig = [
  { ignores: ["src/lib/db/client"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
