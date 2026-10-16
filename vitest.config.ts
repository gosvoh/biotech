import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve TypeScript "paths" aliases (e.g. "@/*") natively.
  resolve: { tsconfigPaths: true },
  test: {
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    maxWorkers: 2,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
