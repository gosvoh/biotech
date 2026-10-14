/** Worker-side transport: cache invalidation must run inside the Next request context. */
export function createWorkerCache(options: { port: number; secret: string; timeoutMs?: number }) {
 if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535 || !options.secret) throw new Error("Некорректные настройки обновления кеша.");
 let revision = 0, applied = 0;
 const flush = async () => {
  if (revision === applied) return;
  const requested = revision;
  try {
   const response = await fetch(`http://127.0.0.1:${options.port}/api/internal/revalidate`, {
    method: "POST", headers: { "x-revalidate-secret": options.secret },
    redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
   });
   await response.body?.cancel();
   if (!response.ok) throw new Error();
   applied = requested;
  } catch { throw new Error("Не удалось обновить кеш новостей."); }
 };
 return { get pending() { return revision !== applied; }, flush, async invalidate() { revision++; await flush(); } };
}
