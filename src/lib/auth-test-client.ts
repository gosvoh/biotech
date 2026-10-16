import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";
import type { PrismaClient, Prisma } from "@/lib/db/client";
import type { GetPrismaClientConfig } from "@/lib/db/client/runtime/library";

let TestClient: typeof PrismaClient | undefined;

// The generated module reads dotenv at import before configOverride can run.
// Execute an in-memory copy with only its env-path metadata emptied. Original
// generated files, require cache and process-wide fs/environment stay untouched.
function loadTestClient(): typeof PrismaClient {
  if (TestClient) return TestClient;
  const filename = fileURLToPath(new URL("./db/client/index.js", import.meta.url));
  const source = readFileSync(filename, "utf8");
  const envMetadata = /"relativeEnvPaths"\s*:\s*\{[^{}]*\}/g;
  if ([...source.matchAll(envMetadata)].length !== 1) throw new Error("Unsupported generated Prisma env metadata");
  const isolatedSource = source.replace(envMetadata, '"relativeEnvPaths": {}');
  const testModule = { exports: {} as { PrismaClient?: typeof PrismaClient } };
  const execute = compileFunction(isolatedSource, ["exports", "require", "module", "__filename", "__dirname"], { filename });
  execute(testModule.exports, createRequire(filename), testModule, filename, dirname(filename));
  if (!testModule.exports.PrismaClient) throw new Error("Generated Prisma constructor not found");
  TestClient = testModule.exports.PrismaClient;
  return TestClient;
}

export function createAuthTestClient(url: string): PrismaClient {
  const Client = loadTestClient();
  const options = {
    datasources: { db: { url } },
    __internal: {
      // Verified against installed Prisma 6.19.3: applied before tryLoadEnvs.
      configOverride: (config: GetPrismaClientConfig): GetPrismaClientConfig => ({ ...config, relativeEnvPaths: {} }),
    },
  };
  // Generated public options omit the runtime's documented test-only hook.
  const constructorOptions: Prisma.PrismaClientOptions = options;
  return new Client(constructorOptions);
}
