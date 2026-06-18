import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve TypeScript "paths" aliases (e.g. "@/*") natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
