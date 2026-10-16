import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ["src/lib/db/client", "database/vk-import/**", "database/admin-redesign/**"] },
];

export default eslintConfig;
