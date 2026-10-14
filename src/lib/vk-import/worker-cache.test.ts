import { afterEach, expect, it } from "vitest";
import { createServer, type Server, type RequestListener } from "node:http";
import { createWorkerCache } from "./worker-cache";
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }))); });
async function serve(handler: RequestListener) {
 const server=createServer(handler); servers.push(server);
 await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
 return (server.address() as {port:number}).port;
}
it("retries the saved invalidation after the web server recovers",async()=>{
 let ready=false, changed=false;
 const port=await serve((req,res)=>{ if(req.url!=="/api/internal/revalidate"||req.headers["x-revalidate-secret"]!=="private") {res.writeHead(401).end();return;} if(ready)changed=true;res.writeHead(ready?200:503).end(); });
 const cache=createWorkerCache({port,secret:"private"});
 await expect(cache.invalidate()).rejects.toThrow("Не удалось обновить кеш новостей.");
 expect(cache.pending).toBe(true); expect(changed).toBe(false);
 ready=true; await cache.flush(); expect(cache.pending).toBe(false);expect(changed).toBe(true);
});
it("does not follow redirects or send the shared secret to another listener",async()=>{
 let reached=false;
 const target=await serve((_req,res)=>{reached=true;res.end();});
 const port=await serve((_req,res)=>res.writeHead(302,{location:`http://127.0.0.1:${target}/steal`}).end());
 const cache=createWorkerCache({port,secret:"private"});
 await expect(cache.invalidate()).rejects.toThrow(); expect(reached).toBe(false);expect(cache.pending).toBe(true);
});
it("bounds a stalled request and retains pending work without exposing response text",async()=>{
 const port=await serve(()=>{});const cache=createWorkerCache({port,secret:"private",timeoutMs:25});
 await expect(cache.invalidate()).rejects.toThrow("Не удалось обновить кеш новостей.");expect(cache.pending).toBe(true);
});
