const port = process.env.PORT ?? "3000";
const secret = process.env.REVALIDATE_SECRET;
const url = `http://127.0.0.1:${port}/api/internal/revalidate`;

const timeoutMs = 30_000;
const retryDelayMs = 500;

async function warmUp(): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-revalidate-secret": secret! },
    });
    if (response.ok) {
      const body = await response.json();
      console.log("[warm-cache] Revalidated:", body.revalidated?.join(", "));
      return true;
    }
  } catch {
    // Server not ready yet, retry below.
  }
  return false;
}

async function main() {
  if (!secret) {
    console.warn("[warm-cache] REVALIDATE_SECRET is not set, skipping.");
    return;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await warmUp()) return;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  console.warn("[warm-cache] Gave up after timeout; relying on lazy revalidation.");
}

await main();

export {};
