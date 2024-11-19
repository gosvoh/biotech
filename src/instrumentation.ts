import { execSync } from "child_process";

export function register() {
  execSync("npx --yes prisma migrate deploy");
}
