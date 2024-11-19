export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { execSync } = await import("child_process");
    execSync("npx --yes prisma migrate deploy");
  }
}
