import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { createAuthTestClient } from "./auth-test-client";

// All auth tests use newly-created databases, never the repository's .env URL.
export async function createAuthFixture() {
  const root = resolve("database/admin-redesign");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, "task-3-test-"));
  const url = `file:${join(directory, "test.db")}`;
  writeFileSync(join(directory, "test.db"), "");
  writeFileSync(join(directory, "package.json"), "{}");
  writeFileSync(join(directory, ".env"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  async function cleanup() {
    const local = relative(root, resolve(directory));
    if (local.startsWith("task-3-test-") && !local.includes(sep)) {
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } else throw new Error("Unsafe auth fixture cleanup path");
  }
  try {
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", join(directory, "schema.prisma")], {
      cwd: directory, stdio: "pipe", env: { ...process.env, DATABASE_URL: url, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` },
    });
  } catch (error) { await cleanup(); throw error; }
  const db = createAuthTestClient(url);
  return {
    db, url,
    async reset() {
      await db.session.deleteMany();
      await db.verificationToken.deleteMany();
      await db.user.deleteMany();
      await db.authRateLimit.deleteMany();
    },
    async close() {
      await db.$disconnect();
      await cleanup();
    },
  };
}
