export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { execSync } = await import("child_process");
    execSync("npm run db:deploy");
  }
}
