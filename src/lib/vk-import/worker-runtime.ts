function wait(ms: number, signal: AbortSignal): Promise<void> {
 return new Promise(resolve => {
  const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
  const timer = setTimeout(done, ms);
  signal.addEventListener("abort", done, { once: true });
  if (signal.aborted) done();
 });
}
export interface VkWorkerLoop {
 signal: AbortSignal;
 /** True requests another bounded queue batch soon; durable deadlines remain in the scheduler. */
 tick: () => Promise<boolean>;
 flush: () => Promise<void>;
 disconnect: () => Promise<void>;
 onError?: () => void;
 pollMs?: number;
 queuedPollMs?: number;
}
/** Shutdown drains the current bounded operation, then releases the database connection. */
export async function runVkWorker(options: VkWorkerLoop): Promise<void> {
 try {
  while (!options.signal.aborted) {
   let queued = false, cacheReady = true;
   try { await options.flush(); } catch { cacheReady = false; options.onError?.(); }
   if (options.signal.aborted) break;
   if (cacheReady) { try { queued = await options.tick(); } catch { options.onError?.(); } }
   if (options.signal.aborted) break;
   await wait(queued ? options.queuedPollMs ?? 1000 : options.pollMs ?? 30_000, options.signal);
  }
 } finally { await options.disconnect(); }
}
