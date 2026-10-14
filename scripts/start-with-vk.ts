import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function runtimeEnvironment(args: string[], environment: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
 let port = environment.PORT ?? "3000";
 for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") port = args[++i] ?? "";
  else if (args[i].startsWith("--port=")) port = args[i].slice(7);
  else if (/^-p\d+$/.test(args[i])) port = args[i].slice(2);
 }
 if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Укажите порт приложения от 1 до 65535.");
 return { ...environment, PORT: String(Number(port)), REVALIDATE_SECRET: environment.REVALIDATE_SECRET || randomBytes(32).toString("hex") };
}

export function webCommand(mode: "dev" | "start" | "standalone", args: string[]): string[] {
 const explicitBundler = args.some(arg => ["--webpack", "--turbopack", "--turbo"].includes(arg));
 return mode === "standalone" ? [...args] : [process.execPath, "--bun", resolve("node_modules/next/dist/bin/next"), mode, ...(mode === "dev" && !explicitBundler ? ["--turbopack"] : []), ...args];
}

/** One owner for the web process, importer and optional startup cache warmup. */
export async function superviseApplication(options: {
 web: string[]; worker: string[]; warmCache?: string[]; env: Record<string, string | undefined>; signal: AbortSignal; shutdownMs?: number;
}): Promise<number> {
 const children: ReturnType<typeof Bun.spawn>[] = [];
 const spawn = (command: string[], ipc = false) => {
  const child = Bun.spawn(command, {
   env: options.env, stdin: "inherit", stdout: "inherit", stderr: "inherit",
   ...(ipc ? { ipc() {} } : {}),
  });
  children.push(child);
  return child;
 };
 let onAbort: (() => void) | undefined;
 const settle = async (child: ReturnType<typeof Bun.spawn>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
   await Promise.race([child.exited, new Promise<void>(resolve => { timer=setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, options.shutdownMs ?? 60_000); })]);
   await child.exited;
  } finally { clearTimeout(timer); }
 };
 let web: ReturnType<typeof Bun.spawn> | undefined, worker: ReturnType<typeof Bun.spawn> | undefined;
 try {
  if (options.signal.aborted) return 0;
  web=spawn(options.web); worker=spawn(options.worker,true);
  if (options.warmCache) spawn(options.warmCache);
  const stopped=new Promise<null>(resolve => { onAbort=()=>resolve(null); options.signal.addEventListener("abort",onAbort,{once:true}); if(options.signal.aborted)onAbort(); });
  const exit=await Promise.race([web.exited,worker.exited,stopped]);
  if(exit!==null) console.error("[app] Web server or VK worker stopped; shutting down the application.");
  return exit===null?0:exit||1;
 } finally {
  if(onAbort)options.signal.removeEventListener("abort",onAbort);
  if(worker&&worker.exitCode===null) {
   try { worker.send({type:"shutdown"}); } catch { worker.kill("SIGTERM"); }
   await settle(worker);
  }
  for(const child of children) {
   if(child===worker)continue;
   if(child.exitCode===null)child.kill("SIGTERM");
   await settle(child);
  }
 }
}

async function main() {
 const [mode,...forwarded]=process.argv.slice(2);
 if(mode!=="dev"&&mode!=="start"&&mode!=="standalone")throw new Error("Ожидается режим dev, start или standalone.");
 const args=forwarded.filter((arg,index)=>arg!=="--"||index!==0);
 const env=runtimeEnvironment(args);
 const standalone=mode==="standalone";
 const worker=standalone?"scripts/vk-worker.js":"scripts/vk-worker.ts";
 if(!existsSync(worker))throw new Error("Исполнитель ВК не собран. Выполните сборку приложения.");
 const web=webCommand(mode,args);
 if(!web.length)throw new Error("Не указана команда веб-сервера.");
 const stop=new AbortController();
 const shutdown=()=>stop.abort();
 process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
 try {
  process.exitCode=await superviseApplication({web,worker:[process.execPath,worker],...(standalone?{warmCache:[process.execPath,"scripts/warm-cache.ts"]}:{}),env,signal:stop.signal});
 } finally { process.off("SIGINT",shutdown);process.off("SIGTERM",shutdown); }
}
if(import.meta.main) await main().catch(()=> { console.error("[app] Не удалось запустить приложение и исполнитель ВК.");process.exitCode=1; });
